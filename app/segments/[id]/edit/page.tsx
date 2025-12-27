
"use client";
import React, { useEffect, useState } from 'react';
import Segmento from '@/app/components/segmento';
import { notFound, useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function EditSegmentPage() {
    const params = useParams();
    const id = params.id as string;
    const [initialData, setInitialData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetch(`/api/segments/${id}`)
                .then(res => {
                    if (!res.ok) throw new Error('Not found');
                    return res.json();
                })
                .then(data => {
                    setInitialData({
                        id: data.id,
                        videoUrl: `/api/videos/${data.videoFilename}`,
                        segments: data.subtitles
                    });
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false); // Should handle not found better
                });
        }
    }, [id]);

    if (loading) return <div className="p-8 text-center">Cargando datos del segmento...</div>;
    if (!initialData) return <div className="p-8 text-center text-red-500">Segmento no encontrado</div>;

    return (
         <div>
            <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                 <Link href="/segments" className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Volver a la Lista
                 </Link>
                 <span className="text-sm font-bold text-gray-500">Modo Edición: ID {id}</span>
            </div>
            <Segmento mode="edit" initialData={initialData} />
        </div>
    );
}
