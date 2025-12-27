"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, BookmarkPlus, Clock, ArrowDown, ArrowUp, Upload, Video, FileText, Pencil, Trash2, Save } from 'lucide-react';

// Interfaces para tipado
interface VideoSegment {
    id: number;
    start: number;
    end: number;
    label: string;
}

interface SubtitleSegment {
    tiempo_ms: number;
    texto: string;
}

interface SegmentoProps {
    mode?: 'create' | 'edit' | 'view';
    initialData?: {
        id?: string;
        videoUrl?: string;
        subtitles?: SubtitleSegment[]; // Or VideoSegment[] if pre-processed
        segments?: VideoSegment[];
    };
    onSaveSuccess?: () => void;
}

// Función utilitaria para convertir segundos a formato MM:SS.xx
const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00.00';

    // Asegura que solo se usan 2 decimales para la visualización
    const totalSeconds = parseFloat(seconds.toFixed(2));

    const minutes = Math.floor(totalSeconds / 60);
    const secsWithMillis = totalSeconds % 60;

    const integerSeconds = Math.floor(secsWithMillis);
    // Extrae la parte decimal y la paddea a dos dígitos (ej: .5 -> 50)
    const milliseconds = (secsWithMillis - integerSeconds).toFixed(2).substring(2);

    const pad = (num: number): string => num.toString().padStart(2, '0');

    return `${pad(minutes)}:${pad(integerSeconds)}.${milliseconds}`;
};

// Componente principal de la aplicación
const Segmento: React.FC<SegmentoProps> = ({ mode = 'create', initialData, onSaveSuccess }) => {
    // --- ESTADOS DE LA APLICACIÓN ---
    const [videoSrc, setVideoSrc] = useState<string | null>(initialData?.videoUrl || null);
    const [startTime, setStartTime] = useState<number | string>(0.00);
    const [endTime, setEndTime] = useState<number | string>(0.00);
    const [segments, setSegments] = useState<VideoSegment[]>(initialData?.segments || []);
    const [segmentLabel, setSegmentLabel] = useState<string>(''); // Nuevo estado para la etiqueta
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [videoLoaded, setVideoLoaded] = useState<boolean>(!!initialData?.videoUrl);
    const [subtitleData, setSubtitleData] = useState<SubtitleSegment[] | null>(null);
    // NUEVO ESTADO: ID del segmento que se está editando. Null si no se edita.
    const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null);
    const [playSegmentId, setPlaySegmentId] = useState<number | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null); // State for the actual file object
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [showSaveMenu, setShowSaveMenu] = useState<boolean>(false);
    // Referencia para el elemento de video HTML
    const videoRef = useRef<HTMLVideoElement>(null);

    const isReadOnly = mode === 'view';

    // --- LÓGICA DE CARGA Y LIMPIEZA DE ARCHIVO ---

    // Efecto para revocar la URL Blob temporal cuando el componente se desmonta o el archivo cambia
    useEffect(() => {
        const previousSrc = videoSrc;
        return () => {
            // Only revoke if it was a blob URL created by us (starts with blob:)
            if (previousSrc && previousSrc.startsWith('blob:')) {
                URL.revokeObjectURL(previousSrc);
            }
        };
    }, [videoSrc]);

    // Maneja la selección del archivo de video
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        setStatusMessage('');
        setVideoLoaded(false);

        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const newVideoSrc = URL.createObjectURL(file);

            if (videoSrc && videoSrc.startsWith('blob:')) {
                URL.revokeObjectURL(videoSrc);
            }

            setVideoSrc(newVideoSrc);
            setVideoFile(file); // Store file for backend upload
            
            // Si estamos en modo 'create', limpiamos todo para empezar de cero.
            // Si estamos en 'edit', conservamos los segmentos (asumiendo que solo reemplazamos el archivo de video de fondo)
            if (mode === 'create') {
                setSegments([]);
                setStartTime(0.00);
                setEndTime(0.00);
                setSegmentLabel('');
                setEditingSegmentId(null);
            }

            setStatusMessage(`Video cargado: ${file.name}. Esperando metadatos.`);
        }
    };

    /**
     * Procesa la lista de subtítulos y genera la lista de segmentos de reproducción.
     * @param {Array} captions - Array de objetos de subtítulos ({tiempo_ms, texto}).
     * @param {number} duration - Duración total del video.
     */
    const processSegments = (captions: SubtitleSegment[], duration: number): void => {
        const videoDuration = parseFloat(duration.toFixed(2));
        const newSegments: VideoSegment[] = [];

        for (let i = 0; i < captions.length; i++) {
            const currentData = captions[i];
            const nextData = captions[i + 1];

            // 1. Calcular el tiempo de inicio en segundos
            const start = parseFloat((currentData.tiempo_ms / 1000).toFixed(2));

            let end: number;

            if (nextData) {
                // 2. El final es el inicio del siguiente segmento
                end = parseFloat((nextData.tiempo_ms / 1000).toFixed(2));
            } else {
                // 3. El final del último segmento es la duración total del video
                end = videoDuration;

                if (end <= start) {
                    // Si la duración es demasiado corta para el último segmento, damos un margen de 5 segundos
                    end = start + 5.00;
                }
            }

            if (start >= end || start >= videoDuration) {
                console.warn(`Segmento ${i + 1} inválido u fuera de rango y omitido.`);
                continue;
            }

            newSegments.push({
                id: Date.now() + i, // ID único
                start: start,
                end: end,
                label: currentData.texto, // Usamos el texto del subtítulo como etiqueta
            });
        }

        setSegments(newSegments);
        setStatusMessage(`✅ Segmentos cargados automáticamente (${newSegments.length}) desde el archivo.`);
    };


    // Maneja la carga de metadatos del video (duración, etc.)
    const handleMetadataLoaded = (): void => {
        if (videoRef.current) {
            setVideoLoaded(true);
            const duration = videoRef.current.duration;
            setStatusMessage(`¡Video listo para segmentar! Duración: ${formatTime(duration)}.`);

            // Si los subtítulos ya están cargados, procesamos los segmentos inmediatamente
            if (subtitleData) {
                processSegments(subtitleData, duration);
            }
        }
    };

    // --- FUNCIÓN DE CARGA DINÁMICA DE SUBTÍTULOS (JSON O TXT) ---
    const handleSubtitleFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        setStatusMessage('');
        setSubtitleData(null);
        setSegments([]);
        setSegmentLabel(''); // Reiniciar etiqueta
        setEditingSegmentId(null); // Limpiar modo edición

        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];
        const fileName = file.name.toLowerCase();
        const isJson = fileName.endsWith('.json');
        const isTxt = fileName.endsWith('.txt');

        if (!isJson && !isTxt) {
            setStatusMessage('Error: Por favor, sube un archivo JSON o TXT.');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const fileContent = e.target?.result as string;
                let parsedData: SubtitleSegment[] = [];
                let isValidFormat = false;

                if (isJson) {
                    // 1. Lógica para JSON (compatible con la estructura tiempo_ms y texto)
                    parsedData = JSON.parse(fileContent);
                    isValidFormat = Array.isArray(parsedData) && parsedData.every(item =>
                        item.tiempo_ms !== undefined && typeof item.tiempo_ms === 'number' && item.texto !== undefined && typeof item.texto === 'string'
                    );

                } else if (isTxt) {
                    // 2. Lógica para TXT (Formato asumido: tiempo_ms|texto)
                    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
                    parsedData = lines.map((line, index) => {
                        const parts = line.split('|', 2); // Split only on the first '|'
                        if (parts.length === 2) {
                            const tiempo_ms = parseInt(parts[0].trim(), 10);
                            const texto = parts[1].trim();

                            if (!isNaN(tiempo_ms) && tiempo_ms >= 0 && texto.length > 0) {
                                return { tiempo_ms, texto };
                            }
                        }
                        console.warn(`Línea TXT inválida (omitiendo línea ${index + 1}): ${line}`);
                        return null;
                    }).filter((item): item is SubtitleSegment => item !== null);

                    isValidFormat = parsedData.length > 0;

                    if (!isValidFormat) {
                        setStatusMessage('Error: El formato TXT debe ser "tiempo_ms|texto" por línea. No se encontraron segmentos válidos.');
                        return;
                    }
                }

                if (isValidFormat) {
                    setSubtitleData(parsedData);
                    // Mensaje de estado actualizado para confirmar la estructura del JSON
                    setStatusMessage(`Archivo de subtítulos (${isJson ? 'JSON (Estructura correcta)' : 'TXT'}) cargado: ${file.name}. ${parsedData.length} entradas encontradas. ${videoLoaded ? 'Generando segmentos...' : 'Esperando a que el video esté listo.'}`);

                    // Si el video ya está listo, procesamos los segmentos inmediatamente
                    if (videoRef.current && videoRef.current.readyState >= 1) {
                        const duration = videoRef.current.duration;
                        processSegments(parsedData, duration);
                    }

                } else {
                    setStatusMessage('Error: El formato no es compatible. Espera un array de objetos con "tiempo_ms" (número) y "texto" (string) para JSON, o líneas "tiempo_ms|texto" para TXT.');
                }
            } catch (error) {
                setStatusMessage(`Error al procesar el archivo: ${(error as Error).message}`);
                console.error("File parsing error:", error);
            }
        };

        reader.onerror = () => {
            setStatusMessage('Error: No se pudo leer el archivo de subtítulos.');
        };

        reader.readAsText(file);
    };


    // --- MANEJO DE LA LÓGICA DE LA APLICACIÓN (TIEMPOS Y SEGMENTOS) ---

    // Función genérica para manejar los cambios en los inputs de tiempo (permite decimales fluidos)
    const handleTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<number | string>>): void => {
        const value = e.target.value;

        // Si el valor está vacío o solo es un punto, lo dejamos como string temporalmente
        if (value === '' || value === '.') {
            setter(value);
            return;
        }

        // Intentamos parsear a float, asegurando que no es NaN ni negativo
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
            setter(parseFloat(numValue.toFixed(2)));
        } else if (!isNaN(numValue) && numValue < 0) {
            setter(0.00);
        }
    };

    // Función para capturar el tiempo actual del video
    const handleCaptureTime = (type: 'start' | 'end'): void => {
        const video = videoRef.current;
        if (video && videoLoaded) {
            const time = parseFloat(video.currentTime.toFixed(2));
            if (type === 'start') {
                setStartTime(time);
            } else {
                setEndTime(time);
            }
            setStatusMessage(`Tiempo de ${type === 'start' ? 'Inicio' : 'Fin'} capturado: ${formatTime(time)}`);
            // Si estamos editando y capturamos un tiempo, el botón de acción principal sigue siendo "Guardar Edición"
        } else {
            setStatusMessage('El video no está listo.');
        }
    };

    // Función para cargar los datos de un segmento a los inputs para edición
    const handleEditSegment = (segment: VideoSegment): void => {
        setStartTime(segment.start);
        setEndTime(segment.end);
        setSegmentLabel(segment.label); // Cargar etiqueta existente
        setEditingSegmentId(segment.id);
        setStatusMessage(`Modo Edición: Segmento ID ${segment.id} cargado. Presiona 'GUARDAR EDICIÓN'.`);

        // Desplazar al área de inputs para editar
        const manualControls = document.getElementById('manual-controls');
        if (manualControls) {
            manualControls.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Función para duplicar un segmento
    const handleDuplicateSegment = (segment: VideoSegment): void => {
        const newSegment: VideoSegment = {
            ...segment,
            id: Date.now() + Math.random(), // Nuevo ID único
            label: `(COPIA) ${segment.label}`, // Etiqueta para indicar que es una copia
        };
        setSegments([...segments, newSegment]);
        setStatusMessage(`Segmento duplicado: ${newSegment.label}`);
        setEditingSegmentId(null); // Desactivar modo edición al duplicar
        setStartTime(0.00); // Limpiar inputs
        setEndTime(0.00);
        setSegmentLabel('');
    };

    // Función para eliminar un segmento
    const handleDeleteSegment = (id: number): void => {
        setSegments(segments.filter(s => s.id !== id));
        setStatusMessage(`Segmento ID ${id} eliminado.`);

        // Si eliminamos el segmento que se estaba editando, salimos del modo edición
        if (editingSegmentId === id) {
            setEditingSegmentId(null);
            setStartTime(0.00);
            setEndTime(0.00);
            setSegmentLabel('');
        }
    };

    // Función para agregar un nuevo segmento O actualizar el segmento que se está editando
    const handleAddOrUpdateSegment = (): void => {
        if (!videoLoaded) {
            setStatusMessage('Carga un video primero.');
            return;
        }

        // Asegurar que los valores son numéricos
        const start = typeof startTime === 'string' ? parseFloat(startTime) : startTime;
        const end = typeof endTime === 'string' ? parseFloat(endTime) : endTime;

        if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
            setStatusMessage('Los tiempos de inicio y fin deben ser números positivos.');
            return;
        }

        const startFixed = parseFloat(start.toFixed(2));
        const endFixed = parseFloat(end.toFixed(2));

        if (startFixed >= endFixed) {
            setStatusMessage('Error: El tiempo de inicio debe ser menor que el tiempo de fin.');
            return;
        }
        if (videoRef.current && endFixed > videoRef.current.duration) {
            setStatusMessage('Error: El tiempo final excede la duración total del video.');
            return;
        }

        if (editingSegmentId) {
            // MODO EDICIÓN
            setSegments(segments.map(s =>
                s.id === editingSegmentId
                    ? {
                        ...s,
                        start: startFixed,
                        end: endFixed,
                        label: segmentLabel.trim() !== ''
                            ? segmentLabel
                            : (s.label.startsWith('(COPIA)') ? s.label : `Segmento Actualizado: ${formatTime(startFixed)} - ${formatTime(endFixed)}`)
                    }
                    : s
            ));
            setStatusMessage(`Segmento ID ${editingSegmentId} ¡ACTUALIZADO!`);

            // Limpiar estado de edición
            setEditingSegmentId(null);
            setStartTime(0.00);
            setEndTime(0.00);
            setSegmentLabel('');

        } else {
            // MODO AGREGAR
            const newSegment: VideoSegment = {
                id: Date.now(),
                start: startFixed,
                end: endFixed,
                label: segmentLabel.trim() !== ''
                    ? segmentLabel
                    : `Segmento Nuevo ${segments.length + 1}: ${formatTime(startFixed)} - ${formatTime(endFixed)}`,
            };

            setSegments([...segments, newSegment]);
            setStatusMessage(`Segmento agregado: ${newSegment.label}`);
            setStartTime(0.00);
            setEndTime(0.00);
            setSegmentLabel('');
        }
    };

    // Función principal para reproducir un segmento
    // Efecto para controlar la pausa automática al final del segmento
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            if (playSegmentId !== null) {
                const currentSegment = segments.find(s => s.id === playSegmentId);
                // Usamos una pequeña tolerancia o "fudge factor" si es necesario, pero >= suele bastar
                if (currentSegment && video.currentTime >= currentSegment.end) {
                    video.pause();
                    setPlaySegmentId(null); // Salimos del modo "reproducción de segmento"
                    setStatusMessage(`Segmento finalizado: ${currentSegment.label}`);
                }
            }
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [playSegmentId, segments]);

    // Función principal para reproducir un segmento
    const handlePlaySegment = (segment: VideoSegment): void => {
        const video = videoRef.current;
        console.log("handlePlaySegment called", segment);
        if (!video) {
            console.error("Video ref is null");
            setStatusMessage('Error: Referencia de video no encontrada.');
            return;
        }
        if (!videoLoaded) {
            console.warn("Video not loaded yet");
            setStatusMessage('El video no está listo. (Not loaded)');
            // Attempt to play anyway if src is set as it might trigger load
            if (!video.src) return; 
        }

        console.log("Seeking to:", segment.start);
        try {
             video.currentTime = segment.start;
             setPlaySegmentId(segment.id);
             video.play().catch(e => {
                 console.error("Play error:", e);
                 setStatusMessage(`Error al reproducir: ${e.message}`);
             });
        } catch (e) {
             console.error("Seek error:", e);
        }
    };

    // Detener cualquier reproducción de segmento si el usuario pausa manualmente
    const handlePause = (): void => {

        setStatusMessage("Reproducción de segmento detenida.");
        videoRef.current?.pause();
    };

    // --- GUARDAR EN BACKEND ---
    const handleSaveToBackend = async (saveType: 'video' | 'subtitles' | 'both') => {
        // Validación: Video requerido si saveType es 'video' o 'both' en CREATE
        if (mode === 'create' && (saveType === 'video' || saveType === 'both') && !videoFile) {
            setStatusMessage('Error: No hay video cargado para guardar.');
            return;
        }

        setIsSaving(true);
        setStatusMessage(`Guardando ${saveType === 'both' ? 'todo' : saveType}...`);
        setShowSaveMenu(false); // Close menu

        const formData = new FormData();
        
        // Append based on type
        if (saveType === 'video' || saveType === 'both') {
            if (videoFile) {
                formData.append('video', videoFile);
            }
        }
        
        if (saveType === 'subtitles' || saveType === 'both') {
             formData.append('subtitles', JSON.stringify(segments, null, 2));
        }

        try {
            let url = '/api/segments';
            let method = 'POST';

            if (mode === 'edit' && initialData?.id) {
                url = `/api/segments/${initialData.id}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                setStatusMessage(`✅ ${mode === 'edit' ? 'Actualizado' : 'Guardado'} exitosamente.`);
                if (onSaveSuccess && mode === 'create') onSaveSuccess(); // Only redirect or callback on create if needed
            } else {
                setStatusMessage(`❌ Error: ${result.error || result.message}`);
            }
        } catch (error) {
            setStatusMessage(`❌ Error de conexión: ${(error as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };


    // --- RENDERIZADO DEL COMPONENTE ---

    const inputClasses = "p-2 w-full border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150";
    const buttonBaseClasses = "flex items-center justify-center space-x-2 py-2 px-4 rounded-lg font-semibold shadow-md transition duration-200 hover:shadow-lg focus:outline-none focus:ring-4";

    // Validaciones
    const start = typeof startTime === 'string' ? parseFloat(startTime) : startTime;
    const end = typeof endTime === 'string' ? parseFloat(endTime) : endTime;
    const isSegmentValid = videoLoaded && !isNaN(start) && !isNaN(end) && start < end && start >= 0;
    const isVideoActionEnabled = videoLoaded;

    // Lógica para el botón principal (Agregar/Guardar Edición)
    const isEditing = editingSegmentId !== null;
    const mainButtonText = isEditing ? 'GUARDAR EDICIÓN' : 'AGREGAR';
    const mainButtonColor = isEditing ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-300' : 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-300';

    // Mensaje de estado para la carga automática
    let autoLoadMessage = '';
    if (videoLoaded && subtitleData && segments.length === 0) {
        autoLoadMessage = 'Video y archivo cargados. Generando segmentos automáticamente...';
    } else if (videoLoaded && !subtitleData) {
        autoLoadMessage = 'Video cargado. Por favor, sube el archivo de subtítulos (JSON o TXT).';
    } else if (!videoLoaded && subtitleData) {
        autoLoadMessage = 'Archivo de subtítulos cargado. Por favor, sube el archivo de video.';
    } else if (!videoLoaded && !subtitleData) {
        autoLoadMessage = 'Sube un video y un archivo de subtítulos para comenzar la segmentación.';
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 flex items-center">
                <Video className="w-8 h-8 mr-3 text-indigo-600" />
                Controlador de Segmentos de Video Local
            </h1>

            {/* SECCIÓN DE CARGA DE ARCHIVOS - VISIBLE EN CREATE Y EDIT */}
            {!isReadOnly && (
            <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">
                    {mode === 'edit' ? 'Reemplazar Archivos (Opcional)' : 'Paso 1: Cargar Archivos'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* CARGA DE VIDEO */}
                    <div className="flex flex-col space-y-2 p-4 border rounded-lg bg-gray-50">
                        <label htmlFor="video-upload" className="block text-sm font-medium text-gray-700 flex items-center">
                            <Upload className="w-4 h-4 mr-2 text-indigo-500" /> Cargar Video (.mp4, .mov):
                        </label>
                        <input
                            id="video-upload"
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
                        />
                    </div>

                    {/* CARGA DE SUBTÍTULOS JSON/TXT */}
                    <div className="flex flex-col space-y-2 p-4 border rounded-lg bg-gray-50">
                        <label htmlFor="subtitle-upload" className="block text-sm font-medium text-gray-700 flex items-center">
                            <FileText className="w-4 h-4 mr-2 text-purple-500" /> Cargar Subtítulos (JSON o TXT):
                        </label>
                        <input
                            id="subtitle-upload"
                            type="file"
                            accept=".json,.txt"
                            onChange={handleSubtitleFileChange}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
                        />
                    </div>
                </div>
            </div>
            )}


            {/* CONTENEDOR PRINCIPAL: VIDEO Y LISTA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* COLUMNA 1 & 2: REPRODUCTOR Y CONTROLES */}
                <div className="lg:col-span-2">

                    {/* REPRODUCTOR DE VIDEO */}
                    <div className="aspect-video w-full mb-6 rounded-xl overflow-hidden shadow-2xl transition duration-300">
                        {videoSrc ? (
                            <video
                                ref={videoRef}
                                src={videoSrc}
                                controls
                                className="w-full h-full bg-gray-800"
                                onLoadedMetadata={handleMetadataLoaded}
                                onPause={handlePause}
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-600 text-center p-8">
                                <Video className="w-10 h-10 mr-3" />
                                {mode === 'create' ? 'Selecciona un archivo de video local.' : 'Video no disponible.'}
                            </div>
                        )}
                    </div>


                    {/* MENSAJES DE ESTADO */}
                    {statusMessage && (
                        <div className={`p-4 rounded-lg text-sm mb-6 ${statusMessage.includes('Error') || statusMessage.includes('❌') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {statusMessage}
                        </div>
                    )}

                    {/* MENSAJE DE ESTADO DE CARGA AUTOMÁTICA */}
                    <div className="mb-6">
                        {segments.length === 0 && (
                            <p className="text-sm p-3 rounded-lg bg-yellow-100 text-yellow-800 text-center italic border border-yellow-300">
                                {autoLoadMessage}
                            </p>
                        )}
                        {segments.length > 0 && (
                            <p className="text-sm p-3 rounded-lg bg-indigo-100 text-indigo-800 text-center italic border border-indigo-300">
                                {segments.length} segmentos listos para usar (cargados automáticamente o manualmente).
                            </p>
                        )}
                    </div>


                    {/* CONTROLES DE SEGMENTOS MANUALES - SOLO SI NO ES READONLY */}
                    {!isReadOnly && (
                    <div id="manual-controls" className="p-6 bg-white rounded-xl shadow-lg border border-gray-100">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                            <Clock className="w-5 h-5 mr-2 text-indigo-500" />
                            {isEditing ? 'Editar Segmento' : 'Definir Nuevo Segmento'}
                        </h2>

                        {/* Nuevo Input para la Etiqueta */}
                        <div className="mb-4">
                            <label className="text-xs font-medium text-gray-500 block mb-1">Etiqueta / Título del Segmento (Opcional)</label>
                            <input
                                type="text"
                                value={segmentLabel}
                                onChange={(e) => setSegmentLabel(e.target.value)}
                                placeholder="Ej: Intro, Frase difícil..."
                                className={inputClasses}
                                disabled={!isVideoActionEnabled}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

                            {/* Inicio */}
                            <div className="flex flex-col space-y-2">
                                <label className="text-xs font-medium text-gray-500">Tiempo de Inicio ({formatTime(typeof startTime === 'number' ? startTime : parseFloat(startTime as string))})</label>
                                <div className="flex items-center space-x-1">
                                    <input
                                        type="number"
                                        value={startTime}
                                        onChange={(e) => handleTimeInputChange(e, setStartTime)}
                                        className={inputClasses}
                                        min="0"
                                        step="0.01"
                                        disabled={!isVideoActionEnabled}
                                    />
                                    <button
                                        onClick={() => handleCaptureTime('start')}
                                        disabled={!isVideoActionEnabled}
                                        className="p-2 rounded bg-green-500 text-white hover:bg-green-600 focus:outline-none"
                                        title="Capturar Inicio"
                                    >
                                        <ArrowDown className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Final */}
                            <div className="flex flex-col space-y-2">
                                <label className="text-xs font-medium text-gray-500">Tiempo de Fin ({formatTime(typeof endTime === 'number' ? endTime : parseFloat(endTime as string))})</label>
                                <div className="flex items-center space-x-1">
                                    <input
                                        type="number"
                                        value={endTime}
                                        onChange={(e) => handleTimeInputChange(e, setEndTime)}
                                        className={inputClasses}
                                        min="0"
                                        step="0.01"
                                        disabled={!isVideoActionEnabled}
                                    />
                                    <button
                                        onClick={() => handleCaptureTime('end')}
                                        disabled={!isVideoActionEnabled}
                                        className="p-2 rounded bg-red-500 text-white hover:bg-red-600 focus:outline-none"
                                        title="Capturar Final"
                                    >
                                        <ArrowUp className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Botón de AGREGAR / GUARDAR EDICIÓN */}
                            <div className="flex flex-col space-y-2 justify-end pt-5 md:pt-0">
                                <button
                                    onClick={handleAddOrUpdateSegment}
                                    disabled={!isSegmentValid}
                                    className={`${buttonBaseClasses} ${mainButtonColor} text-white h-full disabled:opacity-50`}
                                >
                                    {isEditing ? <Pencil className="w-5 h-5" /> : <BookmarkPlus className="w-5 h-5" />}
                                    {mainButtonText}
                                </button>
                            </div>

                        </div>
                    </div>
                    )}
                </div>

                {/* COLUMNA 3: LISTA DE SEGMENTOS */}
                <div className="lg:col-span-1">
                    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-100 sticky lg:top-4">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-xl font-bold text-gray-800">
                                Lista de Segmentos ({segments.length})
                            </h2>
                            {!isReadOnly && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowSaveMenu(!showSaveMenu)}
                                    disabled={isSaving || !videoLoaded}
                                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-white shadow-sm transition ${
                                        isSaving || !videoLoaded
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                    title="Opciones de Guardado"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{isSaving ? 'Guardando...' : 'Guardar...'}</span>
                                </button>
                                
                                {showSaveMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200 overflow-hidden">
                                        <div className="py-1">
                                            <button
                                                onClick={() => handleSaveToBackend('video')}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                            >
                                                <Video className="w-4 h-4 mr-2 text-blue-500" /> Solo Video
                                            </button>
                                            <button
                                                onClick={() => handleSaveToBackend('subtitles')}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                            >
                                                <FileText className="w-4 h-4 mr-2 text-purple-500" /> Solo Subtítulos
                                            </button>
                                            <button
                                                onClick={() => handleSaveToBackend('both')}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center border-t"
                                            >
                                                <Save className="w-4 h-4 mr-2 text-green-500" /> Ambos (Todo)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            )}
                        </div>

                        {segments.length === 0 ? (
                            <p className="text-gray-500 italic">Define y agrega segmentos o carga un archivo de subtítulos para ver la lista aquí.</p>
                        ) : (
                            <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {segments.map((segment) => (
                                    <li key={segment.id} className={segment.id === editingSegmentId ? 'border-2 border-yellow-500 rounded-lg' : ''}>
                                        <div
                                            className="w-full text-left p-3 border-l-4 border-indigo-400 bg-indigo-50 hover:bg-indigo-100 rounded-lg shadow-sm transition duration-150 flex flex-col sm:flex-row justify-between items-start sm:items-center"
                                        >
                                            <div>
                                                <p className="text-sm font-bold text-indigo-800">{segment.label}</p>
                                                <p className="text-xs text-indigo-600 mb-2 sm:mb-0">
                                                    ({formatTime(segment.start)} a {formatTime(segment.end)})
                                                </p>
                                            </div>

                                            <div className="flex space-x-2 mt-2 sm:mt-0">
                                                {/* Botón Play */}
                                                <button
                                                    onClick={() => handlePlaySegment(segment)}
                                                    className="p-1.5 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition duration-150"
                                                    title="Reproducir Segmento"
                                                >
                                                    {playSegmentId === segment.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                </button>

                                                {/* Botones de Edición - SOLO SI NO ES READONLY */}
                                                {!isReadOnly && (
                                                <>
                                                    <button
                                                        onClick={() => handleEditSegment(segment)}
                                                        className="p-1.5 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition duration-150"
                                                        title="Editar Segmento"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    
                                                    <button
                                                        onClick={() => handleDuplicateSegment(segment)}
                                                        className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition duration-150"
                                                        title="Duplicar Segmento"
                                                    >
                                                        <BookmarkPlus className="w-4 h-4" />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteSegment(segment.id)}
                                                        className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-150"
                                                        title="Eliminar Segmento"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Segmento;