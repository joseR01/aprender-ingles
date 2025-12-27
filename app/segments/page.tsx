
"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Edit, Eye, Trash2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SegmentEntry {
    id: string;
    title: string;
    videoFilename: string;
    subtitleFilename: string | null;
    createdAt: string;
}

export default function SegmentsList() {
    const [segments, setSegments] = useState<SegmentEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchSegments();
    }, []);

    const fetchSegments = async () => {
        try {
            const res = await fetch('/api/segments');
            if (res.ok) {
                const data = await res.json();
                setSegments(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este segmento?')) return;
        try {
            const res = await fetch(`/api/segments/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSegments(segments.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error('Error deleting', error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
                        <Video className="w-8 h-8 mr-3 text-indigo-600" />
                        Lista de Videos Segmentados
                    </h1>
                    <Link href="/segments/create" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg flex items-center transition shadow-md font-semibold">
                        <Plus className="w-5 h-5 mr-2" />
                        Nuevo Video
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-gray-500">Cargando segmentos...</p>
                    </div>
                ) : segments.length === 0 ? (
                    <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
                        <Video className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-xl font-medium text-gray-900 mb-2">No hay videos guardados</h3>
                        <p className="mb-6">Sube tu primer video para comenzar a segmentar.</p>
                        <Link href="/segments/create" className="text-indigo-600 hover:text-indigo-800 font-semibold underline">
                            Crear Nuevo Segmento
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                        <ul className="divide-y divide-gray-200">
                            {segments.map((segment) => (
                                <li key={segment.id} className="hover:bg-gray-50 transition duration-150">
                                    <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                                        <div className="flex items-center mb-4 sm:mb-0">
                                            <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mr-4">
                                                <Video className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{segment.title}</h3>
                                                <p className="text-xs text-gray-500">
                                                    ID: {segment.id} • Creado el: {new Date(segment.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-3 w-full sm:w-auto justify-end">
                                            <Link
                                                href={`/segments/${segment.id}/view`}
                                                className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <Eye className="w-4 h-4 mr-2 text-blue-500" />
                                                Ver
                                            </Link>
                                            <Link
                                                href={`/segments/${segment.id}/edit`}
                                                className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                            >
                                                <Edit className="w-4 h-4 mr-2 text-yellow-500" />
                                                Editar
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(segment.id)}
                                                className="flex items-center px-3 py-2 border border-red-200 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
