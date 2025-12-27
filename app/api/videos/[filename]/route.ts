
import { NextRequest, NextResponse } from 'next/server';
import { stat, open } from 'fs/promises';
import path from 'path';
import { VIDEOS_DIR } from '@/app/lib/storage';

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
    const { filename } = await params;
    const videoPath = path.join(VIDEOS_DIR, filename);

    try {
        const stats = await stat(videoPath);
        const fileSize = stats.size;
        const range = request.headers.get('range');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            const file = await open(videoPath, 'r');
            // Create a ReadableStream for the partial content
            const stream = new ReadableStream({
                async start(controller) {
                    const buffer = Buffer.alloc(chunksize);
                    await file.read(buffer, 0, chunksize, start);
                    await file.close();
                    controller.enqueue(buffer);
                    controller.close();
                }
            });

            const headers = new Headers();
            headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            headers.set('Accept-Ranges', 'bytes');
            headers.set('Content-Length', chunksize.toString());
            headers.set('Content-Type', 'video/mp4');

            return new NextResponse(stream as any, {
                status: 206,
                headers,
            });

        } else {
            const file = await open(videoPath, 'r');
            const stream = new ReadableStream({
                async start(controller) {
                    const buffer = await file.readFile();
                    await file.close();
                    controller.enqueue(buffer);
                    controller.close();
                }
            });

            const headers = new Headers();
            headers.set('Content-Length', fileSize.toString());
            headers.set('Content-Type', 'video/mp4');
            
            return new NextResponse(stream as any, {
                status: 200,
                headers,
            });
        }
    } catch (e) {
        console.error("Video serve error:", e);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
}
