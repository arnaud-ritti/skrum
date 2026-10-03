export const PhotoSize = 512;

const JpegQuality = 0.85;

/** What a transparent PNG shows through once it is a JPEG, which has no alpha. */
const JpegBackground = '#ffffff';

/** The largest square centred in the image. */
export function squareCrop(
    width: number,
    height: number,
): { sx: number; sy: number; size: number } {
    const size = Math.min(width, height);

    return {
        sx: Math.floor((width - size) / 2),
        sy: Math.floor((height - size) / 2),
        size,
    };
}

async function readBitmap(file: File): Promise<ImageBitmap | null> {
    if (typeof createImageBitmap !== 'function') {
        return null;
    }

    try {
        return await createImageBitmap(file);
    } catch {
        return null;
    }
}

function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', JpegQuality),
    );
}

/**
 * The photo as the profile stores it: the centred square drawn at `size`
 * pixels and encoded as a JPEG, which also leaves the file's metadata behind.
 * The original file comes back when the browser cannot do it, and the server
 * decides.
 */
export async function toSquareJpeg(
    file: File,
    size: number = PhotoSize,
): Promise<File> {
    const bitmap = await readBitmap(file);

    if (bitmap === null) {
        return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (context === null) {
        bitmap.close();

        return file;
    }

    const { sx, sy, size: side } = squareCrop(bitmap.width, bitmap.height);
    context.fillStyle = JpegBackground;
    context.fillRect(0, 0, size, size);
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    bitmap.close();

    const blob = await encode(canvas);

    if (blob === null) {
        return file;
    }

    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}
