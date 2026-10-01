import { StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import {
    CaptureUpdateAction,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';

const Size = 200;

export const StickyColors = [
    '#fff3bf',
    '#ffd8a8',
    '#ffc9c9',
    '#d0bfff',
    '#a5d8ff',
    '#b2f2bb',
] as const;

function randomInteger(): number {
    return Math.floor(Math.random() * 2 ** 31);
}

function randomId(): string {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 20);
}

/** A sticky note is a rectangle the server recognises by its marker (spec §6.1). */
function stickyAt(x: number, y: number, color: string) {
    return {
        id: randomId(),
        type: 'rectangle',
        x,
        y,
        width: Size,
        height: Size,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: color,
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

export function StickyTool({ api }: { api: ExcalidrawImperativeAPI }) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    const add = (color: string) => {
        const { scrollX, scrollY, zoom, width, height } = api.getAppState();
        const x = width / 2 / zoom.value - scrollX - Size / 2;
        const y = height / 2 / zoom.value - scrollY - Size / 2;
        const sticky = stickyAt(x, y, color);
        const [restored] = restoreElements([sticky] as never, null);

        api.updateScene({
            elements: [...api.getSceneElementsIncludingDeleted(), restored],
            appState: { selectedElementIds: { [sticky.id]: true } } as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                    <StickyNote className="size-4" />
                    {t('Sticky note')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="flex gap-1 p-2">
                {StickyColors.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className="size-7 rounded border"
                        style={{ backgroundColor: color }}
                        aria-label={t('Add a sticky note')}
                        onClick={() => add(color)}
                    />
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
