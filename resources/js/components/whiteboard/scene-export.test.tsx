import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SceneExport } from './scene-export';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    serializeAsJSON: () => '{"type":"excalidraw"}',
}));

vi.mock('@inertiajs/react', async (original) => ({
    ...(await original<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('SceneExport', () => {
    it('keeps the file address alive until the browser has taken the download', () => {
        vi.useFakeTimers();

        const revoke = vi.fn();

        vi.stubGlobal('URL', {
            createObjectURL: () => 'blob:scene',
            revokeObjectURL: revoke,
        });
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
            () => {},
        );

        renderWithProviders(
            <SceneExport
                title="Sprint board"
                elements={[]}
                appState={{} as never}
                files={{}}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Download board data' }),
        );

        expect(revoke).not.toHaveBeenCalled();

        vi.runAllTimers();

        expect(revoke).toHaveBeenCalledWith('blob:scene');
    });
});
