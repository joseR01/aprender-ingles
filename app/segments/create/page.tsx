
"use client";
import React from 'react';
import Segmento from '@/app/components/segmento';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateSegmentPage() {
    const router = useRouter();

    return (
        <div>
            <div className="p-4 bg-gray-50 border-b">
                 <Link href="/segments" className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Volver a la Lista
                 </Link>
            </div>
            <Segmento 
                mode="create" 
                onSaveSuccess={() => {
                    // We could redirect, but staying on page allows further edits or adding more
                    // router.push('/segments');
                }} 
            />
        </div>
    );
}
