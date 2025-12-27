
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const data = await request.formData();
        const videoFile: File | null = data.get('video') as unknown as File;
        const subtitles: string | null = data.get('subtitles') as unknown as string;

        if (!videoFile) {
            return NextResponse.json({ success: false, message: 'No video file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await videoFile.arrayBuffer());
        const videoFileName = videoFile.name.replace(/\s/g, '_');
        
        // Ensure uploads directories exist
        const uploadBaseDir = path.join(process.cwd(), 'uploads');
        const videoDir = path.join(uploadBaseDir, 'videos');
        const subtitlesDir = path.join(uploadBaseDir, 'subtitles');

        await mkdir(videoDir, { recursive: true });
        await mkdir(subtitlesDir, { recursive: true });

        // Save Video
        const videoPath = path.join(videoDir, videoFileName);
        await writeFile(videoPath, buffer);

        // Save Subtitles (if provided)
        if (subtitles) {
            // Use the video filename but with .json extension
            const subtitleFileName = path.parse(videoFileName).name + '.json';
            const subtitlePath = path.join(subtitlesDir, subtitleFileName);
            await writeFile(subtitlePath, subtitles);
        }

        return NextResponse.json({ success: true, message: 'Files saved successfully' });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
