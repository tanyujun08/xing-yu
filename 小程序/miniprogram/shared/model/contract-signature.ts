export interface SignaturePoint { x: number; y: number }
export type SignatureStroke = SignaturePoint[];
export type { components } from '../../../types/api/schema';

/** Normalized in-memory strokes; tiny taps do not count as a handwritten name. */
export function signatureStrokeQuality(strokes: SignatureStroke[], width: number, height: number) {
    let distance = 0, points = 0, minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const stroke of strokes) for (let i = 0; i < stroke.length; i++) {
        const p = stroke[i]!;
        if (![p.x, p.y].every(Number.isFinite) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return false;
        points++; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        const prior = stroke[i - 1];
        if (prior) distance += Math.hypot((p.x - prior.x) * width, (p.y - prior.y) * height);
    }
    return width > 0 && height > 0 && points >= 8 && distance >= 48 && (maxX - minX) * width >= 20 && (maxY - minY) * height >= 12;
}
