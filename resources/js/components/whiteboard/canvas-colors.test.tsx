import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasColors } from '@/components/whiteboard/canvas-colors';
import { POSTIT } from '@/lib/whiteboard/palette';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
}));

function element(id: string, type: string, backgroundColor: string) {
    return {
        id,
        type,
        isDeleted: false,
        backgroundColor,
        strokeColor: '#1e1e1e',
        fillStyle: 'hachure',
        version: 3,
        versionNonce: 7,
    };
}

function canvas(selectedElementIds: Record<string, true> = {}) {
    const elements = [
        element('note', 'rectangle', POSTIT.sun.bg),
        element('label', 'text', 'transparent'),
        element('other', 'ellipse', POSTIT.coral.bg),
    ];

    return {
        getSceneElementsIncludingDeleted: vi.fn(() => elements),
        getAppState: vi.fn(() => ({ selectedElementIds })),
        updateScene: vi.fn(),
    };
}

describe('CanvasColors', () => {
    it('renders nothing while the bar has no use', () => {
        const { container } = renderWithProviders(
            <CanvasColors
                api={canvas() as never}
                state={{ visible: false, value: null }}
            />,
        );

        expect(container.querySelector('[role="radiogroup"]')).toBeNull();
    });

    it('shows the eight colours with the current one checked', () => {
        renderWithProviders(
            <CanvasColors
                api={canvas() as never}
                state={{ visible: true, value: 'sky' }}
            />,
        );

        expect(
            screen.getByRole('radiogroup', { name: 'Fill colour' }),
        ).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'Sky' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('makes the colour the fill of the next shapes when nothing is selected', () => {
        const api = canvas();

        renderWithProviders(
            <CanvasColors
                api={api as never}
                state={{ visible: true, value: 'sun' }}
            />,
        );
        fireEvent.click(screen.getByRole('radio', { name: 'Moss' }));

        expect(api.updateScene).toHaveBeenCalledTimes(1);

        const update = api.updateScene.mock.calls[0][0];

        expect(update.elements).toBeUndefined();
        expect(update.appState).toEqual({
            currentItemBackgroundColor: POSTIT.moss.bg,
            currentItemStrokeColor: POSTIT.moss.stroke,
            currentItemFillStyle: 'solid',
        });
    });

    it('recolours the selected shapes that have a fill, and only them', () => {
        const api = canvas({ note: true, label: true });

        renderWithProviders(
            <CanvasColors
                api={api as never}
                state={{ visible: true, value: 'sun' }}
            />,
        );
        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

        const [note, label, other] = api.updateScene.mock.calls[0][0].elements;

        expect(note).toMatchObject({
            backgroundColor: POSTIT.sky.bg,
            strokeColor: POSTIT.sky.stroke,
            fillStyle: 'solid',
            version: 4,
        });
        expect(label).toMatchObject({
            backgroundColor: 'transparent',
            version: 3,
        });
        expect(other).toMatchObject({
            backgroundColor: POSTIT.coral.bg,
            version: 3,
        });
        expect(api.updateScene.mock.calls[0][0].captureUpdate).toBe(
            'IMMEDIATELY',
        );
    });

    it('keeps a place after the bar for the actions on a selection', () => {
        renderWithProviders(
            <CanvasColors
                api={canvas() as never}
                state={{ visible: true, value: 'sun' }}
                selectionActions={<button type="button">Later</button>}
            />,
        );

        expect(screen.getByRole('button', { name: 'Later' })).toBeTruthy();
    });
});
