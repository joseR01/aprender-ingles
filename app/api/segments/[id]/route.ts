
import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { getSegmentById, updateSegment, deleteSegment, VIDEOS_DIR, SUBS_DIR } from '@/app/lib/storage';


export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const segment = await getSegmentById(id);
    if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // Load subtitles content
    let subtitles = [];
    if (segment.subtitleFilename) {
        try {
            const subPath = path.join(SUBS_DIR, segment.subtitleFilename);
            const subData = await readFile(subPath, 'utf-8');
            subtitles = JSON.parse(subData);
        } catch (e) {
            console.error("Error reading subtitles", e);
        }
    }

    return NextResponse.json({ ...segment, subtitles });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const segment = await getSegmentById(id);
    if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    try {
        const formData = await request.formData();
        const subtitles = formData.get('subtitles') as string;
        // Optionally handle video replacement here if needed, but usually we just update subs/title
        
        if (subtitles && segment.subtitleFilename) {
            const subPath = path.join(SUBS_DIR, segment.subtitleFilename);
            await writeFile(subPath, subtitles);
        }
        
        return NextResponse.json({ success: true, message: 'Updated successfully' });
    } catch (error) {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const segment = await getSegmentById(id);
    if (!segment) {
        return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    try {
        // Try deleting files
        const videoPath = path.join(VIDEOS_DIR, segment.videoFilename);
        const subPath = segment.subtitleFilename ? path.join(SUBS_DIR, segment.subtitleFilename) : null;
        
        try { await unlink(videoPath); } catch (e) {}
        if (subPath) { try { await unlink(subPath); } catch (e) {} }

        await deleteSegment(id);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}

