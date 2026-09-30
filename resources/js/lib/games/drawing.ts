import type {
    DrawingColor,
    DrawingOp,
    DrawingPoint,
    DrawingSize,
} from './types';

export const DrawingWidth = 1000;
export const DrawingHeight = 750;
export const RasterWidth = 800;
export const RasterHeight = 600;
export const MaxStrokePoints = 1000;
export const EraserColor: DrawingColor = 'white';

export const DrawingColors: DrawingColor[] = [
    'black',
    'red',
    'orange',
    'green',
    'blue',
    'purple',
];

export const DrawingSizes: DrawingSize[] = [4, 10, 24];

const Scale = RasterWidth / DrawingWidth;

/** Index 0 is the white background of a fresh raster. */
const Palette: [DrawingColor, [number, number, number]][] = [
    ['white', [255, 255, 255]],
    ['black', [23, 23, 23]],
    ['red', [220, 38, 38]],
    ['orange', [234, 88, 12]],
    ['green', [22, 163, 74]],
    ['blue', [37, 99, 235]],
    ['purple', [147, 51, 234]],
];

const PaletteIndex = new Map<DrawingColor, number>(
    Palette.map(([color], index) => [color, index]),
);

const PaletteRgb = Uint8Array.from(Palette.flatMap(([, rgb]) => rgb));

/** One palette index per pixel of the 800 × 600 grid. */
export type Raster = Uint8Array;

export function isDrawingColor(value: unknown): value is DrawingColor {
    return typeof value === 'string' && PaletteIndex.has(value as DrawingColor);
}

export function isDrawingSize(value: unknown): value is DrawingSize {
    return DrawingSizes.includes(value as DrawingSize);
}

export function isDrawingPoint(value: unknown): value is DrawingPoint {
    if (!Array.isArray(value) || value.length !== 2) {
        return false;
    }

    const [x, y] = value as unknown[];

    return (
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        (x as number) >= 0 &&
        (x as number) <= DrawingWidth &&
        (y as number) >= 0 &&
        (y as number) <= DrawingHeight
    );
}

export function colorCss(color: DrawingColor): string {
    const [red, green, blue] = Palette[PaletteIndex.get(color) ?? 0][1];

    return `rgb(${red} ${green} ${blue})`;
}

export function strokeRadius(size: DrawingSize): number {
    return Math.max(1, Math.round((size * Scale) / 2));
}

export function createRaster(): Raster {
    return new Uint8Array(RasterWidth * RasterHeight);
}

const disks = new Map<number, number[]>();

/** Offsets `[dx, dy, dx, dy, …]` of a filled disk, cached per radius. */
function disk(radius: number): number[] {
    const cached = disks.get(radius);

    if (cached) {
        return cached;
    }

    const offsets: number[] = [];
    const limit = radius * radius + radius;

    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= limit) {
                offsets.push(dx, dy);
            }
        }
    }

    disks.set(radius, offsets);

    return offsets;
}

function stamp(
    raster: Raster,
    x: number,
    y: number,
    offsets: number[],
    index: number,
): void {
    for (let offset = 0; offset < offsets.length; offset += 2) {
        const pixelX = x + offsets[offset];
        const pixelY = y + offsets[offset + 1];

        if (
            pixelX < 0 ||
            pixelY < 0 ||
            pixelX >= RasterWidth ||
            pixelY >= RasterHeight
        ) {
            continue;
        }

        raster[pixelY * RasterWidth + pixelX] = index;
    }
}

function toRaster(value: number, size: number): number {
    return Math.min(size - 1, Math.max(0, Math.round(value * Scale)));
}

function drawStroke(
    raster: Raster,
    points: DrawingPoint[],
    size: DrawingSize,
    index: number,
): void {
    const radius = strokeRadius(size);
    const offsets = disk(radius);
    const spacing = Math.max(1, radius / 2);
    let previousX = toRaster(points[0][0], RasterWidth);
    let previousY = toRaster(points[0][1], RasterHeight);

    stamp(raster, previousX, previousY, offsets, index);

    for (let point = 1; point < points.length; point++) {
        const x = toRaster(points[point][0], RasterWidth);
        const y = toRaster(points[point][1], RasterHeight);
        const steps = Math.max(
            1,
            Math.ceil(Math.hypot(x - previousX, y - previousY) / spacing),
        );

        for (let step = 1; step <= steps; step++) {
            stamp(
                raster,
                Math.round(previousX + ((x - previousX) * step) / steps),
                Math.round(previousY + ((y - previousY) * step) / steps),
                offsets,
                index,
            );
        }

        previousX = x;
        previousY = y;
    }
}

/** Exact 4-connected scanline fill of the region under (x, y). */
export function floodFill(
    raster: Raster,
    x: number,
    y: number,
    index: number,
): void {
    const target = raster[y * RasterWidth + x];

    if (target === index) {
        return;
    }

    const stack: number[] = [x, y];

    while (stack.length > 0) {
        const seedY = stack.pop() as number;
        const seedX = stack.pop() as number;
        const row = seedY * RasterWidth;

        if (raster[row + seedX] !== target) {
            continue;
        }

        let left = seedX;
        let right = seedX;

        while (left > 0 && raster[row + left - 1] === target) {
            left--;
        }

        while (right < RasterWidth - 1 && raster[row + right + 1] === target) {
            right++;
        }

        raster.fill(index, row + left, row + right + 1);

        for (const nextY of [seedY - 1, seedY + 1]) {
            if (nextY < 0 || nextY >= RasterHeight) {
                continue;
            }

            const nextRow = nextY * RasterWidth;
            let inRun = false;

            for (let column = left; column <= right; column++) {
                const matches = raster[nextRow + column] === target;

                if (matches && !inRun) {
                    stack.push(column, nextY);
                }

                inRun = matches;
            }
        }
    }
}

export function applyOp(raster: Raster, op: DrawingOp): void {
    const index = PaletteIndex.get(op.color) ?? 0;

    if (op.type === 'fill') {
        floodFill(
            raster,
            toRaster(op.x, RasterWidth),
            toRaster(op.y, RasterHeight),
            index,
        );

        return;
    }

    if (op.points.length === 0) {
        return;
    }

    drawStroke(raster, op.points, op.size, index);
}

export function replay(ops: DrawingOp[]): Raster {
    const raster = createRaster();

    for (const op of ops) {
        applyOp(raster, op);
    }

    return raster;
}

export function paintRaster(raster: Raster, image: ImageData): void {
    const data = image.data;

    for (let pixel = 0; pixel < raster.length; pixel++) {
        const colour = raster[pixel] * 3;
        const offset = pixel * 4;

        data[offset] = PaletteRgb[colour];
        data[offset + 1] = PaletteRgb[colour + 1];
        data[offset + 2] = PaletteRgb[colour + 2];
        data[offset + 3] = 255;
    }
}

/** Logical canvas coordinates of a pointer over an element showing the drawing. */
export function pointFromEvent(
    event: { clientX: number; clientY: number },
    element: Element,
): DrawingPoint {
    const rect = element.getBoundingClientRect();
    const x = Math.round(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * DrawingWidth,
    );
    const y = Math.round(
        ((event.clientY - rect.top) / Math.max(1, rect.height)) * DrawingHeight,
    );

    return [
        Math.min(DrawingWidth, Math.max(0, x)),
        Math.min(DrawingHeight, Math.max(0, y)),
    ];
}

/** A live stroke, drawn by the browser on top of the committed raster. */
export function drawPreview(
    ctx: CanvasRenderingContext2D,
    color: DrawingColor,
    size: DrawingSize,
    points: DrawingPoint[],
): void {
    if (points.length === 0) {
        return;
    }

    ctx.strokeStyle = colorCss(color);
    ctx.lineWidth = strokeRadius(size) * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0][0] * Scale, points[0][1] * Scale);

    for (const [x, y] of points.length === 1 ? points : points.slice(1)) {
        ctx.lineTo(x * Scale, y * Scale);
    }

    ctx.stroke();
}
