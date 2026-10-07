import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToBlob, exportToSvg } from '@/lib/whiteboard/excalidraw';
import type { BoardScene } from '@/lib/whiteboard/save-file';
import { renderWithProviders } from '@/test/render';
import { ExportDialog } from './export-dialog';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    serializeAsJSON: vi.fn(() => '{"type":"excalidraw"}'),
    exportToBlob: vi.fn(),
    exportToSvg: vi.fn(),
}));

vi.mock('@inertiajs/react', async (original) => ({
    ...(await original<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const Note = { id: 'note', type: 'rectangle', isDeleted: false };
const Arrow = { id: 'arrow', type: 'arrow', isDeleted: false };

function scene(elements: object[] = [Note, Arrow]): BoardScene {
    return {
        elements,
        appState: {
            viewBackgroundColor: '#f8f5f1',
            selectedElementIds: { note: true },
        },
        files: {},
    } as unknown as BoardScene;
}

const saved: string[] = [];
const revoke = vi.fn();

function renderDialog(props: Partial<Parameters<typeof ExportDialog>[0]> = {}) {
    const onOpenChange = vi.fn();

    renderWithProviders(
        <ExportDialog
            open
            onOpenChange={onOpenChange}
            title="Sprint board"
            getScene={() => scene()}
            hasSelection={false}
            {...props}
        />,
    );

    return { onOpenChange, user: userEvent.setup() };
}

function radio(name: string): HTMLElement {
    return screen.getByRole('radio', { name });
}

function download(): HTMLButtonElement {
    return screen.getByRole<HTMLButtonElement>('button', { name: 'Download' });
}

function lastImageAsked() {
    return vi.mocked(exportToBlob).mock.calls.at(-1)![0];
}

beforeEach(() => {
    saved.length = 0;
    vi.mocked(exportToBlob).mockReset();
    vi.mocked(exportToBlob).mockImplementation(
        async () => new Blob(['png'], { type: 'image/png' }),
    );
    vi.mocked(exportToSvg).mockReset();
    vi.mocked(exportToSvg).mockImplementation(async () =>
        document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    );
    revoke.mockClear();
    Object.assign(URL, {
        createObjectURL: () => 'blob:board',
        revokeObjectURL: revoke,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function (this: HTMLAnchorElement) {
            saved.push(this.download);
        },
    );
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('ExportDialog', () => {
    it('opens on Image with PNG, the background and 1×', async () => {
        renderDialog();

        expect(
            screen.getByRole('dialog', { name: 'Export the board' }),
        ).toBeTruthy();
        expect(radio('Image').getAttribute('aria-checked')).toBe('true');
        expect(radio('PNG').getAttribute('aria-checked')).toBe('true');
        expect(radio('1×').getAttribute('aria-checked')).toBe('true');
        expect(
            screen
                .getByRole('switch', { name: 'Background' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        const preview = await screen.findByRole('img', { name: 'Preview' });

        expect(preview.getAttribute('src')).toBe('blob:board');
        expect(lastImageAsked().appState).toMatchObject({
            exportBackground: true,
        });
        expect(lastImageAsked().getDimensions?.(10, 10).scale).toBe(1);
    });

    it('draws the preview again without the background, and lets go of the previous one', async () => {
        const { user } = renderDialog();

        await screen.findByRole('img', { name: 'Preview' });
        await user.click(screen.getByRole('switch', { name: 'Background' }));

        await waitFor(() =>
            expect(lastImageAsked().appState).toMatchObject({
                exportBackground: false,
            }),
        );
        expect(revoke).toHaveBeenCalledWith('blob:board');
    });

    it('turns the size off for SVG', async () => {
        const { user } = renderDialog();

        await user.click(radio('SVG'));

        for (const size of ['1×', '2×', '3×']) {
            expect(radio(size)).toHaveProperty('disabled', true);
        }

        expect(
            screen.getByText('An SVG stays sharp at every size.'),
        ).toBeTruthy();
        await waitFor(() => expect(exportToSvg).toHaveBeenCalled());

        await user.click(radio('PNG'));

        expect(radio('2×')).toHaveProperty('disabled', false);
        expect(
            screen.queryByText('An SVG stays sharp at every size.'),
        ).toBeNull();
    });

    it('offers Only the selection when something is selected', async () => {
        const { user } = renderDialog({ hasSelection: true });

        await user.click(
            screen.getByRole('switch', { name: 'Only the selection' }),
        );

        await waitFor(() =>
            expect(
                lastImageAsked().elements.map(
                    (element: { id: string }) => element.id,
                ),
            ).toEqual(['note']),
        );
    });

    it('has no Only the selection when nothing is selected', () => {
        renderDialog();

        expect(
            screen.queryByRole('switch', { name: 'Only the selection' }),
        ).toBeNull();
    });

    it('downloads the image and closes', async () => {
        const { user, onOpenChange } = renderDialog();

        await user.click(radio('2×'));
        await user.click(download());

        await waitFor(() => expect(saved).toEqual(['Sprint board.png']));
        expect(lastImageAsked().getDimensions?.(10, 10)).toEqual({
            width: 20,
            height: 20,
            scale: 2,
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('downloads an SVG named after the board', async () => {
        const { user, onOpenChange } = renderDialog();

        await user.click(radio('SVG'));
        await user.click(download());

        await waitFor(() => expect(saved).toEqual(['Sprint board.svg']));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('downloads the board data, and keeps the file address alive until the browser has taken it', () => {
        vi.useFakeTimers();

        const { onOpenChange } = renderDialog();

        fireEvent.click(radio('Board data'));

        expect(
            screen.getByText(
                'Everything on the board, as a data file to open again.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('radio', { name: 'PNG' })).toBeNull();

        fireEvent.click(download());

        expect(saved).toEqual(['Sprint board.whiteboard.json']);
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(revoke).not.toHaveBeenCalled();

        vi.runAllTimers();

        expect(revoke).toHaveBeenCalledWith('blob:board');
    });

    it('says so and stays open when the image cannot be made', async () => {
        const { user, onOpenChange } = renderDialog();

        await screen.findByRole('img', { name: 'Preview' });
        vi.mocked(exportToBlob).mockRejectedValue(new Error('canvas'));
        await user.click(download());

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Something went wrong. Please try again.',
        );
        expect(saved).toEqual([]);
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(download().disabled).toBe(false);
    });

    it('turns Download off on an empty board', async () => {
        const { user } = renderDialog({
            getScene: () => scene([{ ...Note, isDeleted: true }]),
        });

        expect(screen.getByText('Nothing to draw yet.')).toBeTruthy();
        expect(download().disabled).toBe(true);
        expect(exportToBlob).not.toHaveBeenCalled();

        await user.click(radio('Board data'));

        expect(download().disabled).toBe(false);
    });

    it('closes on Cancel', async () => {
        const { user, onOpenChange } = renderDialog();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(saved).toEqual([]);
    });
});
