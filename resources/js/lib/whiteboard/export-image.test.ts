import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToBlob, exportToSvg } from '@/lib/whiteboard/excalidraw';
import {
    exportImage,
    hasDrawing,
    imageFileName,
    type ImageOptions,
} from './export-image';
import type { BoardScene } from './save-file';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    exportToBlob: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    exportToSvg: vi.fn(async () => {
        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg',
        );

        svg.setAttribute('data-board', 'drawn');

        return svg;
    }),
}));

const Elements = [
    { id: 'note', type: 'rectangle', isDeleted: false },
    { id: 'words', type: 'text', containerId: 'note', isDeleted: false },
    { id: 'arrow', type: 'arrow', isDeleted: false },
    { id: 'framed', type: 'ellipse', frameId: 'note', isDeleted: false },
    { id: 'gone', type: 'rectangle', isDeleted: true },
];

function scene(selected: string[] = []): BoardScene {
    return {
        elements: Elements,
        appState: {
            viewBackgroundColor: '#f8f5f1',
            selectedElementIds: Object.fromEntries(
                selected.map((id) => [id, true]),
            ),
        },
        files: {},
    } as unknown as BoardScene;
}

function options(overrides: Partial<ImageOptions> = {}): ImageOptions {
    return {
        format: 'png',
        background: true,
        scale: 1,
        selectionOnly: false,
        ...overrides,
    };
}

function ids(elements: readonly { id: string }[]): string[] {
    return elements.map((element) => element.id);
}

beforeEach(() => {
    vi.mocked(exportToBlob).mockClear();
    vi.mocked(exportToSvg).mockClear();
});

describe('exportImage', () => {
    it('asks for a PNG at the chosen scale', async () => {
        const blob = await exportImage(scene(), options({ scale: 2 }));
        const asked = vi.mocked(exportToBlob).mock.calls[0][0];

        expect(blob.type).toBe('image/png');
        expect(asked.mimeType).toBe('image/png');
        expect(asked.getDimensions?.(300, 200)).toEqual({
            width: 600,
            height: 400,
            scale: 2,
        });
        expect(ids(asked.elements)).toEqual([
            'note',
            'words',
            'arrow',
            'framed',
        ]);
        expect(exportToSvg).not.toHaveBeenCalled();
    });

    it('asks for an SVG and returns it as a blob', async () => {
        const blob = await exportImage(scene(), options({ format: 'svg' }));

        expect(blob.type).toBe('image/svg+xml');
        expect(await blob.text()).toContain('data-board="drawn"');
        expect(exportToBlob).not.toHaveBeenCalled();
    });

    it.each([true, false])(
        'passes the background choice (%s)',
        async (background) => {
            await exportImage(scene(), options({ background }));
            await exportImage(scene(), options({ background, format: 'svg' }));

            expect(
                vi.mocked(exportToBlob).mock.calls[0][0].appState,
            ).toMatchObject({
                exportBackground: background,
                viewBackgroundColor: '#f8f5f1',
            });
            expect(
                vi.mocked(exportToSvg).mock.calls[0][0].appState,
            ).toMatchObject({ exportBackground: background });
        },
    );

    it('keeps only the selection when asked, with the text and the content of what is selected', async () => {
        await exportImage(scene(['note']), options({ selectionOnly: true }));
        await exportImage(scene(['note']), options());

        const calls: [{ elements: { id: string }[] }][] =
            vi.mocked(exportToBlob).mock.calls;
        const [selection, whole] = calls.map(([asked]) => ids(asked.elements));

        expect(selection).toEqual(['note', 'words', 'framed']);
        expect(whole).toEqual(['note', 'words', 'arrow', 'framed']);
    });
});

describe('imageFileName', () => {
    it('names the file after the board', () => {
        expect(imageFileName('Sprint board', 'png')).toBe('Sprint board.png');
        expect(imageFileName('Plans/ideas?', 'svg')).toBe('Plans ideas.svg');
        expect(imageFileName(' / ', 'png')).toBe('whiteboard.png');
    });
});

describe('hasDrawing', () => {
    it('is false for a board whose every element is deleted', () => {
        expect(hasDrawing(scene())).toBe(true);
        expect(
            hasDrawing({
                ...scene(),
                elements: Elements.filter((element) => element.isDeleted),
            } as unknown as BoardScene),
        ).toBe(false);
    });
});
