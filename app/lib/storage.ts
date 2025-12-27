
import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
const SUBS_DIR = path.join(UPLOADS_DIR, 'subtitles');

export interface SegmentEntry {
    id: string;
    title: string;
    videoFilename: string | null;
    subtitleFilename: string | null;
    createdAt: string;
}

// Ensure directories exist
export async function ensureDirs() {
    if (!existsSync(process.cwd() + '/data')) await mkdir(process.cwd() + '/data', { recursive: true });
    if (!existsSync(VIDEOS_DIR)) await mkdir(VIDEOS_DIR, { recursive: true });
    if (!existsSync(SUBS_DIR)) await mkdir(SUBS_DIR, { recursive: true });
    
    if (!existsSync(DATA_FILE_PATH)) {
        await writeFile(DATA_FILE_PATH, JSON.stringify([]));
    }
}

export async function getSegments(): Promise<SegmentEntry[]> {
    await ensureDirs();
    const data = await readFile(DATA_FILE_PATH, 'utf-8');
    return JSON.parse(data);
}

export async function saveSegment(entry: SegmentEntry): Promise<void> {
    const segments = await getSegments();
    segments.push(entry);
    await writeFile(DATA_FILE_PATH, JSON.stringify(segments, null, 2));
}

export async function updateSegment(id: string, updates: Partial<SegmentEntry>): Promise<void> {
    let segments = await getSegments();
    segments = segments.map(seg => seg.id === id ? { ...seg, ...updates } : seg);
    await writeFile(DATA_FILE_PATH, JSON.stringify(segments, null, 2));
}

export async function getSegmentById(id: string): Promise<SegmentEntry | undefined> {
    const segments = await getSegments();
    return segments.find(s => s.id === id);
}

export async function deleteSegment(id: string): Promise<void> {
    let segments = await getSegments();
    segments = segments.filter(s => s.id !== id);
    await writeFile(DATA_FILE_PATH, JSON.stringify(segments, null, 2));
}

export { VIDEOS_DIR, SUBS_DIR };
