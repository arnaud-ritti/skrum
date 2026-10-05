import type { LucideIcon } from 'lucide-react';
import { Ellipsis, Redo2, Scan, Undo2 } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { WhiteboardToolbar } from '@/components/skrum/whiteboard-toolbar';
import type { ToolbarItem } from '@/components/skrum/whiteboard-toolbar';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { CanvasToolSubBar } from '@/components/whiteboard/canvas-tools';
import {
    fitToScreen,
    useNativeHistory,
} from '@/components/whiteboard/canvas-view';
import {
    ToolIcons,
    useCanvasTools,
    useToolLabels,
} from '@/components/whiteboard/use-canvas-tools';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useTrans } from '@/hooks/use-trans';
import { pressNativeControl } from '@/lib/whiteboard/canvas-commands';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import { PhoneBarTools, PhoneDrawerTools } from '@/lib/whiteboard/tools';
import { cn } from '@/lib/utils';

type Props = {
    api: ExcalidrawImperativeAPI;
    snapshot: CanvasSnapshot;
    /** The board's canvas wrapper, home of the library's hidden undo and redo buttons. */
    canvas: RefObject<HTMLElement | null>;
};

type DrawerEntry = {
    id: string;
    label: string;
    icon: LucideIcon;
    pressed?: boolean;
    disabled?: boolean;
    onPress: () => void;
};

const toolClasses =
    'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const pressedClasses =
    'bg-skrum-primary-soft text-skrum-primary-text ring-1 ring-primary ring-inset hover:bg-skrum-primary-soft';

/**
 * The phone's tool bar in edit mode (MobileRituals, ScreenWhiteboard
 * "Mobile"): Selection, Sticky note and Pencil in a bar of touch-sized tools,
 * then "More tools", a drawer with the other tools a phone offers (no
 * connector, no frame under `md`), Undo, Redo and Fit to screen. The sub-bar
 * of the sticky note or the shape opens above the bar. It sits in the read
 * mode dock, which places it.
 */
export function PhoneToolbar({
    api,
    snapshot,
    canvas,
}: Props): ReactElement | null {
    const { t } = useTrans();
    const labels = useToolLabels();
    const tools = useCanvasTools(api, snapshot);
    const history = useNativeHistory(canvas);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const currentToolId = useId();
    const { active, choose } = tools;

    if (tools.viewMode) {
        return null;
    }

    const moreLabel = t('More tools');
    const isDrawerToolActive =
        active !== null && PhoneDrawerTools.includes(active);
    const hasSubBar = active === 'sticky' || active === 'shape';

    const barItems: ToolbarItem[] = PhoneBarTools.map((tool) => ({
        id: tool,
        label: labels[tool],
        icon: ToolIcons[tool],
        pressed: active === tool,
        onPress: () => choose(tool),
    }));

    const drawerEntries: DrawerEntry[] = [
        ...PhoneDrawerTools.map((tool) => ({
            id: tool,
            label: labels[tool],
            icon: ToolIcons[tool],
            pressed: active === tool,
            onPress: () => choose(tool),
        })),
        {
            id: 'undo',
            label: t('Undo'),
            icon: Undo2,
            disabled: !history.canUndo,
            onPress: () => pressNativeControl(canvas.current, 'undo'),
        },
        {
            id: 'redo',
            label: t('Redo'),
            icon: Redo2,
            disabled: !history.canRedo,
            onPress: () => pressNativeControl(canvas.current, 'redo'),
        },
        {
            id: 'fit',
            label: t('Fit to screen'),
            icon: Scan,
            onPress: () => fitToScreen(api),
        },
    ];

    return (
        <div data-slot="phone-toolbar" className="pointer-events-auto">
            {hasSubBar && (
                <div
                    data-slot="phone-sub-bar"
                    className="absolute inset-x-0 bottom-full mb-2 flex justify-center"
                >
                    <CanvasToolSubBar
                        api={api}
                        snapshot={snapshot}
                        tools={tools}
                        onAddSticky={(color) => tools.addStickyInView(color)}
                        className="max-w-full flex-wrap justify-center"
                    />
                </div>
            )}
            <WhiteboardToolbar
                label={t('Tools')}
                groups={[barItems]}
                orientation="horizontal"
                size="touch"
                trailing={
                    <button
                        type="button"
                        data-slot="whiteboard-tool"
                        data-roving-item=""
                        aria-label={moreLabel}
                        aria-describedby={
                            isDrawerToolActive ? currentToolId : undefined
                        }
                        aria-haspopup="dialog"
                        aria-expanded={drawerOpen}
                        onClick={() => setDrawerOpen(true)}
                        className={cn(
                            'grid size-11 shrink-0 place-items-center rounded-md text-foreground hover:bg-accent',
                            toolClasses,
                            isDrawerToolActive && pressedClasses,
                        )}
                    >
                        <Ellipsis aria-hidden className="size-4.5" />
                    </button>
                }
            />
            {isDrawerToolActive && (
                <span id={currentToolId} className="sr-only">
                    {t('Current tool: :tool', { tool: labels[active] })}
                </span>
            )}
            <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerContent aria-describedby={undefined}>
                    <DrawerHeader>
                        <DrawerTitle>{moreLabel}</DrawerTitle>
                    </DrawerHeader>
                    <div
                        data-slot="phone-drawer-tools"
                        className="grid grid-cols-4 gap-2"
                    >
                        {drawerEntries.map((entry) => {
                            const Icon = entry.icon;

                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    aria-pressed={entry.pressed}
                                    disabled={entry.disabled}
                                    onClick={() => {
                                        entry.onPress();
                                        setDrawerOpen(false);
                                    }}
                                    className={cn(
                                        'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-lg p-2 text-xs font-medium text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
                                        toolClasses,
                                        entry.pressed && pressedClasses,
                                    )}
                                >
                                    <Icon aria-hidden className="size-5" />
                                    <span className="max-w-full truncate">
                                        {entry.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    );
}
