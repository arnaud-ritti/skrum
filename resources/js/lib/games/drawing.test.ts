import { describe, expect, it } from 'vitest';
import {
    colorCss,
    DrawingColors,
    isDrawingColor,
    paintRaster,
    replay,
} from '@/lib/games/drawing';
import type { DrawingColor } from '@/lib/games/types';

const LegacyColors: DrawingColor[] = [
    'red',
    'orange',
    'green',
    'blue',
    'purple',
];
const ThemeColors: DrawingColor[] = [
    'sun',
    'apricot',
    'coral',
    'plum',
    'iris',
    'sky',
    'lagoon',
    'moss',
];

function fillIndex(color: DrawingColor): number {
    return replay([{ type: 'fill', color, x: 10, y: 10 }])[0];
}

function rgbOf(color: DrawingColor): [number, number, number] {
    const raster = replay([{ type: 'fill', color, x: 10, y: 10 }]);
    const image = { data: new Uint8ClampedArray(raster.length * 4) };

    paintRaster(raster, image as ImageData);

    return [image.data[0], image.data[1], image.data[2]];
}

function luminance([red, green, blue]: [number, number, number]): number {
    const linear = [red, green, blue].map((channel) => {
        const value = channel / 255;

        return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

describe('drawing ink', () => {
    it('offers black and the eight theme colours', () => {
        expect(DrawingColors).toEqual(['black', ...ThemeColors]);
    });

    it('recognises the fifteen colour names', () => {
        const names = ['white', 'black', ...LegacyColors, ...ThemeColors];

        expect(names).toHaveLength(15);
        expect(names.every((name) => isDrawingColor(name))).toBe(true);
        expect(isDrawingColor('pink')).toBe(false);
    });

    it('keeps the palette indexes of white, black and the legacy colours', () => {
        const indexes = (
            ['white', 'black', ...LegacyColors] as DrawingColor[]
        ).map((color) => fillIndex(color));

        expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('rasterises a stored red operation to the same pixels as before', () => {
        expect(rgbOf('red')).toEqual([220, 38, 38]);
        expect(colorCss('red')).toBe('rgb(220 38 38)');
    });

    it.each(ThemeColors)('keeps %s at 3:1 against white paper', (color) => {
        const ratio = 1.05 / (luminance(rgbOf(color)) + 0.05);

        expect(ratio).toBeGreaterThanOrEqual(3);
    });
});
