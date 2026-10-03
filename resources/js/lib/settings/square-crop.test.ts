import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoSize, squareCrop, toSquareJpeg } from './square-crop';

describe('squareCrop', () => {
    it('keeps the centred square of a landscape image', () => {
        expect(squareCrop(800, 600)).toEqual({ sx: 100, sy: 0, size: 600 });
    });

    it('keeps the centred square of a portrait image', () => {
        expect(squareCrop(600, 800)).toEqual({ sx: 0, sy: 100, size: 600 });
    });

    it('keeps a square image whole', () => {
        expect(squareCrop(512, 512)).toEqual({ sx: 0, sy: 0, size: 512 });
    });
});

type CanvasMocks = {
    drawImage: ReturnType<typeof vi.fn>;
    toBlob: ReturnType<typeof vi.fn>;
};

function mockCanvas(blob: Blob | null): CanvasMocks {
    const drawImage = vi.fn();
    const toBlob = vi.fn(
        (callback: BlobCallback, type?: string, quality?: number) => {
            void type;
            void quality;
            callback(blob);
        },
    );

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage,
        fillRect: vi.fn(),
        fillStyle: '',
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
        toBlob as unknown as HTMLCanvasElement['toBlob'],
    );

    return { drawImage, toBlob };
}

function stubBitmap(width: number, height: number) {
    const bitmap = { width, height, close: vi.fn() };

    vi.stubGlobal(
        'createImageBitmap',
        vi.fn(() => Promise.resolve(bitmap)),
    );

    return bitmap;
}

describe('toSquareJpeg', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('draws the centred square at 512 pixels and encodes it as a JPEG', async () => {
        const bitmap = stubBitmap(800, 600);
        const { drawImage, toBlob } = mockCanvas(
            new Blob(['jpeg'], { type: 'image/jpeg' }),
        );
        const original = new File(['png'], 'me.png', { type: 'image/png' });

        const photo = await toSquareJpeg(original);

        expect(drawImage).toHaveBeenCalledWith(
            bitmap,
            100,
            0,
            600,
            600,
            0,
            0,
            PhotoSize,
            PhotoSize,
        );
        expect(toBlob).toHaveBeenCalledWith(
            expect.any(Function),
            'image/jpeg',
            0.85,
        );
        expect(photo.name).toBe('photo.jpg');
        expect(photo.type).toBe('image/jpeg');
        expect(bitmap.close).toHaveBeenCalled();
    });

    it('resolves the original file when the canvas cannot encode', async () => {
        stubBitmap(512, 512);
        mockCanvas(null);
        const original = new File(['png'], 'me.png', { type: 'image/png' });

        expect(await toSquareJpeg(original)).toBe(original);
    });

    it('resolves the original file when the browser cannot read it', async () => {
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn(() => Promise.reject(new Error('unreadable'))),
        );
        const original = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

        expect(await toSquareJpeg(original)).toBe(original);
    });
});
