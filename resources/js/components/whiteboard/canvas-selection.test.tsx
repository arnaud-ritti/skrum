import { fireEvent, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasSelection } from '@/components/whiteboard/canvas-selection';
import type {
    CanvasAppState,
    CanvasSnapshot,
} from '@/hooks/use-canvas-snapshot';
import { POSTIT } from '@/lib/whiteboard/palette';
import {
    selectionBarPlacement,
    selectionCountPlacement,
} from '@/lib/whiteboard/selection';
import type { CanvasView } from '@/lib/whiteboard/viewport';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
    getCommonBounds: vi.fn(
        (
            elements: {
                x: number;
                y: number;
                width: number;
                height: number;
            }[],
        ) => [
            Math.min(...elements.map((element) => element.x)),
            Math.min(...elements.map((element) => element.y)),
            Math.max(...elements.map((element) => element.x + element.width)),
            Math.max(...elements.map((element) => element.y + element.height)),
        ],
    ),
}));

type Element = {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isDeleted: boolean;
    locked: boolean;
    groupIds: string[];
    containerId: string | null;
    backgroundColor: string;
    strokeColor: string;
    fillStyle: string;
    version: number;
    versionNonce: number;
};

function element(
    id: string,
    type: string,
    overrides: Partial<Element> = {},
): Element {
    return {
        id,
        type,
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        isDeleted: false,
        locked: false,
        groupIds: [],
        containerId: null,
        backgroundColor: type === 'text' ? 'transparent' : POSTIT.sun.bg,
        strokeColor: '#1e1e1e',
        fillStyle: 'hachure',
        version: 3,
        versionNonce: 7,
        ...overrides,
    };
}

const View: CanvasView = {
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    width: 1000,
    height: 600,
};

function snapshotOf(
    elements: Element[],
    selected: string[],
    appState: Partial<CanvasAppState> = {},
): CanvasSnapshot {
    return {
        elements: elements as never,
        appState: {
            activeTool: { type: 'selection', customType: null, locked: false },
            selectedElementIds: Object.fromEntries(
                selected.map((id) => [id, true]),
            ),
            currentItemBackgroundColor: POSTIT.sun.bg,
            currentItemStrokeColor: POSTIT.sun.stroke,
            ...appState,
        } as unknown as CanvasAppState,
        view: View,
        stamp: 'stamp',
    };
}

function fakeApi(snapshot: CanvasSnapshot) {
    return {
        getSceneElementsIncludingDeleted: vi.fn(() => snapshot.elements),
        getAppState: vi.fn(() => snapshot.appState),
        updateScene: vi.fn(),
    };
}

type Options = {
    bottomInset?: number;
    isFacilitator?: boolean;
    editing?: boolean;
    stylesShown?: boolean;
    onStylesChange?: (shown: boolean) => void;
};

const keydowns: KeyboardEvent[] = [];

function Board({
    api,
    snapshot,
    isFacilitator = true,
    editing = true,
    stylesShown = false,
    onStylesChange = () => {},
    bottomInset,
}: Options & { api: ReturnType<typeof fakeApi>; snapshot: CanvasSnapshot }) {
    const canvas = useRef<HTMLDivElement>(null);

    return (
        <div ref={canvas}>
            <div
                className="excalidraw-container"
                data-testid="container"
                onKeyDown={(event) => keydowns.push(event.nativeEvent)}
            />
            <CanvasSelection
                api={api as never}
                snapshot={snapshot}
                canvas={canvas}
                isFacilitator={isFacilitator}
                editing={editing}
                stylesShown={stylesShown}
                onStylesChange={onStylesChange}
                bottomInset={bottomInset}
            />
        </div>
    );
}

function renderSelection(snapshot: CanvasSnapshot, options: Options = {}) {
    const api = fakeApi(snapshot);
    const view = renderWithProviders(
        <Board api={api} snapshot={snapshot} {...options} />,
    );

    return {
        api,
        rerender: (next: CanvasSnapshot, nextOptions: Options = options) =>
            view.rerender(<Board api={api} snapshot={next} {...nextOptions} />),
    };
}

function bar(): HTMLElement | null {
    return screen.queryByRole('toolbar', { name: 'Selection' });
}

function chip(): HTMLElement | null {
    return document.querySelector('[data-slot="whiteboard-selection-count"]');
}

function press(name: string): void {
    fireEvent.click(screen.getByRole('button', { name }));
}

function openAlign(): void {
    fireEvent.keyDown(screen.getByRole('button', { name: 'Align' }), {
        key: 'Enter',
    });
}

beforeEach(() => {
    keydowns.length = 0;
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CanvasSelection', () => {
    it('renders nothing without a selection, in view mode, while a text is edited, or when the selected element is a tombstone', () => {
        const note = element('note', 'rectangle');

        const empty = renderSelection(snapshotOf([note], []));
        expect(bar()).toBeNull();
        expect(chip()).toBeNull();

        empty.rerender(snapshotOf([note], ['note']), { editing: false });
        expect(bar()).toBeNull();

        empty.rerender(
            snapshotOf([note], ['note'], { editingTextElement: {} as never }),
        );
        expect(bar()).toBeNull();

        empty.rerender(
            snapshotOf([{ ...note, isDeleted: true }], ['note']),
            {},
        );
        expect(bar()).toBeNull();
        expect(chip()).toBeNull();

        empty.rerender(snapshotOf([note], ['note']), {});
        expect(bar()).not.toBeNull();
    });

    it('places the bar under the common bounds of the selection and the chip on its corner', () => {
        vi.spyOn(
            HTMLElement.prototype,
            'getBoundingClientRect',
        ).mockReturnValue({ width: 300, height: 44 } as DOMRect);
        const first = element('first', 'rectangle', { x: 100, y: 100 });
        const second = element('second', 'ellipse', {
            x: 400,
            y: 150,
            width: 100,
            height: 50,
        });

        renderSelection(snapshotOf([first, second], ['first', 'second']));

        const bounds = { x: 100, y: 100, width: 400, height: 100 };
        const place = selectionBarPlacement(bounds, View, {
            width: 300,
            height: 44,
        });
        const corner = selectionCountPlacement(bounds, View);

        expect(bar()?.style.left).toBe(`${place.left}px`);
        expect(bar()?.style.top).toBe(`${place.top}px`);
        expect(chip()?.style.left).toBe(`${corner?.x}px`);
        expect(chip()?.style.top).toBe(`${corner?.y}px`);
        expect(chip()?.textContent).toBe('2 elements');
    });

    it('recolours the selected shapes that have a fill, and only them, and makes it the next fill', () => {
        const snapshot = snapshotOf(
            [
                element('note', 'rectangle'),
                element('label', 'text'),
                element('other', 'ellipse', {
                    backgroundColor: POSTIT.coral.bg,
                }),
            ],
            ['note', 'label'],
        );
        const { api } = renderSelection(snapshot);

        expect(
            screen
                .getByRole('radio', { name: 'Sun' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

        const update = api.updateScene.mock.calls[0][0];
        const [note, label, other] = update.elements;

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
        expect(update.appState).toEqual({
            currentItemBackgroundColor: POSTIT.sky.bg,
            currentItemStrokeColor: POSTIT.sky.stroke,
            currentItemFillStyle: 'solid',
        });
        expect(update.captureUpdate).toBe('IMMEDIATELY');
    });

    it('shows no colours when nothing selected has a fill', () => {
        renderSelection(
            snapshotOf(
                [element('label', 'text'), element('line', 'line')],
                ['label', 'line'],
            ),
        );

        expect(bar()).not.toBeNull();
        expect(screen.queryByRole('radiogroup')).toBeNull();
    });

    it('sends the library its own shortcut for group, each alignment, delete and lock, with the platform modifier', () => {
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
        renderSelection(
            snapshotOf(
                [
                    element('a', 'rectangle'),
                    element('b', 'rectangle'),
                    element('c', 'rectangle'),
                ],
                ['a', 'b', 'c'],
            ),
        );

        press('Group');

        for (const name of [
            'Align left',
            'Align right',
            'Align top',
            'Align bottom',
            'Distribute horizontally',
            'Distribute vertically',
        ]) {
            openAlign();
            fireEvent.click(screen.getByRole('menuitem', { name }));
        }

        press('Lock');
        press('Delete');

        expect(
            keydowns.map((event) => [
                event.key,
                event.ctrlKey,
                event.shiftKey,
                event.altKey,
            ]),
        ).toEqual([
            ['g', true, false, false],
            ['ArrowLeft', true, true, false],
            ['ArrowRight', true, true, false],
            ['ArrowUp', true, true, false],
            ['ArrowDown', true, true, false],
            ['h', false, false, true],
            ['v', false, false, true],
            ['L', true, true, false],
            ['Delete', false, false, false],
        ]);
    });

    it('uses the command key on an Apple platform and offers Ungroup for one group', () => {
        vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
        renderSelection(
            snapshotOf(
                [
                    element('a', 'rectangle', { groupIds: ['g1'] }),
                    element('b', 'rectangle', { groupIds: ['g1'] }),
                ],
                ['a', 'b'],
            ),
        );

        expect(screen.queryByRole('button', { name: 'Group' })).toBeNull();

        press('Ungroup');

        expect(keydowns).toHaveLength(1);
        expect(keydowns[0]).toMatchObject({
            key: 'G',
            metaKey: true,
            ctrlKey: false,
            shiftKey: true,
        });
    });

    it('offers Lock to the facilitator only, and disables colours and Delete on a locked element for the others', () => {
        const locked = snapshotOf(
            [element('note', 'rectangle', { locked: true })],
            ['note'],
        );
        const view = renderSelection(locked, { isFacilitator: true });

        expect(
            screen
                .getByRole('button', { name: 'Lock' })
                .getAttribute('aria-pressed'),
        ).toBe('true');

        view.rerender(locked, { isFacilitator: false });

        expect(screen.queryByRole('button', { name: /lock/i })).toBeNull();

        const remove = screen.getByRole('button', {
            name: 'Delete',
        }) as HTMLButtonElement;

        expect(remove.disabled).toBe(true);
        expect(
            document.getElementById(
                remove.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Only the facilitator can change a locked element.');
        expect(
            (screen.getByRole('radio', { name: 'Sun' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(
            document.getElementById(
                screen
                    .getByRole('radiogroup')
                    .getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('Only the facilitator can change a locked element.');
    });

    it('toggles the styles panel, and closes it when the selection goes', () => {
        const onStylesChange = vi.fn();
        const note = element('note', 'rectangle');
        const view = renderSelection(snapshotOf([note], ['note']), {
            stylesShown: true,
            onStylesChange,
        });

        press('Styles');

        expect(onStylesChange).toHaveBeenLastCalledWith(false);

        onStylesChange.mockClear();
        view.rerender(snapshotOf([note], ['note']), {
            stylesShown: false,
            onStylesChange,
        });
        press('Styles');

        expect(onStylesChange).toHaveBeenLastCalledWith(true);

        onStylesChange.mockClear();
        view.rerender(snapshotOf([note], []), {
            stylesShown: true,
            onStylesChange,
        });

        expect(onStylesChange).toHaveBeenCalledWith(false);
    });

    it('hides the bar while the selection is dragged and brings it back at the new place', () => {
        vi.spyOn(
            HTMLElement.prototype,
            'getBoundingClientRect',
        ).mockReturnValue({ width: 300, height: 44 } as DOMRect);
        const note = element('note', 'rectangle');
        const view = renderSelection(snapshotOf([note], ['note']));

        view.rerender(
            snapshotOf([note], ['note'], {
                selectedElementsAreBeingDragged: true,
            }),
        );

        expect(bar()).toBeNull();
        expect(chip()).toBeNull();

        const moved = { ...note, x: 300, y: 200 };
        view.rerender(snapshotOf([moved], ['note']));

        const place = selectionBarPlacement(
            { x: 300, y: 200, width: 200, height: 100 },
            View,
            { width: 300, height: 44 },
        );

        expect(bar()?.style.left).toBe(`${place.left}px`);
        expect(bar()?.style.top).toBe(`${place.top}px`);
    });

    it("wraps the bar within a phone's width and keeps it inside the screen, above the dock", () => {
        const phone: CanvasView = { ...View, width: 390, height: 700 };
        const unwrapped = { width: 453, height: 46 };
        vi.spyOn(
            HTMLElement.prototype,
            'getBoundingClientRect',
        ).mockImplementation(function (this: HTMLElement) {
            const room = parseFloat(this.style.maxWidth);

            return (
                Number.isNaN(room) || room >= unwrapped.width
                    ? unwrapped
                    : { width: room, height: unwrapped.height * 2 }
            ) as DOMRect;
        });
        const note = element('note', 'rectangle', { x: 300, y: 560 });

        renderWithProviders(
            <Board
                api={fakeApi(snapshotOf([note], ['note']))}
                snapshot={{ ...snapshotOf([note], ['note']), view: phone }}
                bottomInset={80}
            />,
        );

        const left = parseFloat(bar()?.style.left ?? '');
        const top = parseFloat(bar()?.style.top ?? '');

        expect(bar()?.className).toContain('flex-wrap');
        expect(bar()?.style.maxWidth).toBe('358px');
        expect(left).toBeGreaterThanOrEqual(16);
        expect(left + 358).toBeLessThanOrEqual(390 - 16);
        expect(top + unwrapped.height * 2).toBeLessThanOrEqual(700 - 16 - 80);
    });

    it('keeps no place for actions on a selection', () => {
        renderSelection(snapshotOf([element('note', 'rectangle')], ['note']));

        expect(
            screen
                .getAllByRole('button')
                .map((button) => button.getAttribute('aria-label')),
        ).toEqual(['Align', 'Lock', 'Styles', 'Delete']);
    });
});
