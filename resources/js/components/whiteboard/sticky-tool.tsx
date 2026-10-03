import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { WhiteboardColorBar } from '@/components/skrum/whiteboard-toolbar';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';
import {
    CaptureUpdateAction,
    ToolbarDom,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import {
    DEFAULT_POSTIT_COLOR,
    POSTIT,
    type PostItColor,
} from '@/lib/whiteboard/palette';
import type { Point } from '@/lib/whiteboard/viewport';

const Size = 200;

function randomInteger(): number {
    return Math.floor(Math.random() * 2 ** 31);
}

function randomId(): string {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}

/**
 * A sticky note is a rectangle the server recognises by its marker (spec §6.1).
 * Its fill and its border are the literal light values of one of the eight
 * colours (answers 7-D1 and 7-D4).
 */
function stickyAt(x: number, y: number, color: PostItColor) {
    return {
        id: randomId(),
        type: 'rectangle',
        x,
        y,
        width: Size,
        height: Size,
        angle: 0,
        strokeColor: POSTIT[color].stroke,
        backgroundColor: POSTIT[color].bg,
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: randomInteger(),
        version: 1,
        versionNonce: randomInteger(),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        customData: { skrum: { kind: 'sticky' } },
    };
}

/**
 * Adds a sticky of `color` with its top-left corner at `at` (scene), or
 * centred in the view when `at` is omitted, and selects it. Returns its id.
 */
export function addSticky(
    api: ExcalidrawImperativeAPI,
    color: PostItColor,
    at?: Point,
): string {
    const { scrollX, scrollY, zoom, width, height } = api.getAppState();
    const x = at?.x ?? width / 2 / zoom.value - scrollX - Size / 2;
    const y = at?.y ?? height / 2 / zoom.value - scrollY - Size / 2;
    const sticky = stickyAt(x, y, color);
    const [restored] = restoreElements([sticky] as never, null);

    api.updateScene({
        elements: [...api.getSceneElementsIncludingDeleted(), restored],
        appState: { selectedElementIds: { [sticky.id]: true } } as never,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    return sticky.id;
}

type Props = {
    api: ExcalidrawImperativeAPI;
    /** In the canvas shapes toolbar the trigger looks like the library's tools. */
    inToolbar?: boolean;
    /** The canvas's colour bar gives way while this one is open. */
    onOpenChange?: (open: boolean) => void;
};

/**
 * The colours open as the sub-bar of the tool. A press on a colour adds a
 * note of that colour in the middle of the view; the arrow keys only move
 * the choice, which is kept for the next note.
 */
export function StickyTool({ api, inToolbar = false, onOpenChange }: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const [color, setColor] = useState<PostItColor>(DEFAULT_POSTIT_COLOR);

    const change = (next: boolean): void => {
        setOpen(next);
        onOpenChange?.(next);
    };

    const add = (chosen: PostItColor): void => {
        addSticky(api, chosen);
        change(false);
    };

    return (
        <Popover open={open} onOpenChange={change}>
            <PopoverTrigger asChild>
                {inToolbar ? (
                    <button
                        type="button"
                        className={ToolbarDom.buttonClass}
                        title={t('Sticky note')}
                        aria-label={t('Sticky note')}
                    >
                        <div
                            className={ToolbarDom.iconClass}
                            aria-hidden="true"
                        >
                            <StickyNote />
                        </div>
                    </button>
                ) : (
                    <Button size="sm" variant="outline">
                        <StickyNote className="size-4" />
                        <span className="truncate">{t('Sticky note')}</span>
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent
                align={inToolbar ? 'center' : 'end'}
                aria-label={t('Sticky note')}
                className="rounded-xl border-0 bg-transparent p-0 shadow-none"
            >
                <WhiteboardColorBar
                    value={color}
                    onChange={setColor}
                    onActivate={add}
                />
            </PopoverContent>
        </Popover>
    );
}
