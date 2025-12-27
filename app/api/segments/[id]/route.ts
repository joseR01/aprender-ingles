
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
        const videoFile = formData.get('video') as File;
        
        // Handle Video Replacement
        if (videoFile && segment.videoFilename) {
            const videoPath = path.join(VIDEOS_DIR, segment.videoFilename);
            const buffer = Buffer.from(await videoFile.arrayBuffer());
            await writeFile(videoPath, buffer);
            // We don't update videoFilename usually as it relies on ID, assuming extension doesn't change 
            // ... (rest of logic)
        } else if (videoFile && !segment.videoFilename) {
             // Case: Segment didn't have a video, but now we are uploading one.
             // We need to generate a filename and update the segment.
             const videoExt = path.extname(videoFile.name);
             const newFilename = `${id}${videoExt}`;
             const videoPath = path.join(VIDEOS_DIR, newFilename);
             const buffer = Buffer.from(await videoFile.arrayBuffer());
             await writeFile(videoPath, buffer);
             
             await updateSegment(id, { videoFilename: newFilename });
        }


        // Handle Subtitles Update
        if (subtitles && segment.subtitleFilename) {
            const subPath = path.join(SUBS_DIR, segment.subtitleFilename);
            await writeFile(subPath, subtitles);
        }
        
        return NextResponse.json({ success: true, message: 'Updated successfully' });
    } catch (error) {
        console.error("Update error:", error);
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
        if (segment.videoFilename) {
            const videoPath = path.join(VIDEOS_DIR, segment.videoFilename);
            try { await unlink(videoPath); } catch (e) {
                console.warn(`Could not delete video file: ${videoPath}`, e);
            }
        }
        
        if (segment.subtitleFilename) {
            const subPath = path.join(SUBS_DIR, segment.subtitleFilename);
            try { await unlink(subPath); } catch (e) {
                console.warn(`Could not delete subtitle file: ${subPath}`, e);
            }
        }

        await deleteSegment(id);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}

