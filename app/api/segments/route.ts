
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import { saveSegment, getSegments, ensureDirs, VIDEOS_DIR, SUBS_DIR, SegmentEntry } from '@/app/lib/storage';

export async function GET() {
    try {
        const segments = await getSegments();
        return NextResponse.json(segments);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureDirs();
        const formData = await request.formData();
        const videoFile = formData.get('video') as File;
        const subtitles = formData.get('subtitles') as string;
        
        if (!videoFile && !subtitles) {
             return NextResponse.json({ error: 'Provide at least video or subtitles' }, { status: 400 });
        }

        const id = Date.now().toString();
        
        let videoFilename = null;
        if (videoFile) {
            const videoExt = path.extname(videoFile.name);
            videoFilename = `${id}${videoExt}`;
            const videoPath = path.join(VIDEOS_DIR, videoFilename);
            const buffer = Buffer.from(await videoFile.arrayBuffer());
            await writeFile(videoPath, buffer);
        }

        const subtitleFilename = `${id}.json`;
        const subPath = path.join(SUBS_DIR, subtitleFilename);

        if (subtitles) {
            await writeFile(subPath, subtitles);
        } else {
            // Write empty array if no subtitles initially
            await writeFile(subPath, '[]');
        }

        const newEntry: SegmentEntry = {
            id,
            title: videoFile ? videoFile.name : 'Untitled Segment (No Video)', 
            videoFilename,
            subtitleFilename,
            createdAt: new Date().toISOString()
        };

        await saveSegment(newEntry);

        return NextResponse.json({ success: true, segment: newEntry });

    } catch (error) {
        console.error('Create error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
