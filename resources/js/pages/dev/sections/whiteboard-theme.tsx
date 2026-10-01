import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    Eraser,
    Hand,
    Menu,
    MousePointer2,
    Redo2,
    Square,
    Undo2,
} from 'lucide-react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    WhiteboardColorBar,
    useColorNames,
} from '@/components/skrum/whiteboard-toolbar';
import { useTrans } from '@/hooks/use-trans';
import { PostItColors, POSTIT } from '@/lib/whiteboard/palette';
import type { PostItColor } from '@/lib/whiteboard/palette';
import { cn } from '@/lib/utils';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function ToolButton({
    label,
    shortcut,
    active,
    hover,
    disabled,
    children,
}: {
    label: string;
    shortcut?: string;
    active?: boolean;
    hover?: boolean;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <span
            role="img"
            aria-label={label}
            className={cn(
                'relative flex size-9 items-center justify-center rounded-md border border-transparent text-foreground',
                hover && 'bg-accent',
                active &&
                    'border-primary bg-skrum-primary-soft text-skrum-primary-text',
                disabled && 'opacity-50',
            )}
        >
            {children}
            {shortcut ? (
                <span
                    aria-hidden
                    className="absolute right-1 bottom-0.5 font-mono text-overline text-muted-foreground"
                >
                    {shortcut}
                </span>
            ) : null}
        </span>
    );
}

function CanvasMock({ dark }: { dark?: boolean }) {
    const { t } = useTrans();

    return (
        <div
            className={cn(
                'flex w-full max-w-xl flex-col gap-3 rounded-lg border border-border bg-skrum-canvas p-3 text-foreground',
                dark && 'dark',
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-popover shadow-raised">
                    <Menu className="size-4" aria-hidden />
                </span>
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-raised">
                    <ToolButton label={t('Hand')} shortcut="H">
                        <Hand className="size-4" aria-hidden />
                    </ToolButton>
                    <ToolButton label={t('Selection')} shortcut="1" hover>
                        <MousePointer2 className="size-4" aria-hidden />
                    </ToolButton>
                    <ToolButton label={t('Rectangle')} shortcut="2" active>
                        <Square className="size-4" aria-hidden />
                    </ToolButton>
                    <ToolButton label={t('Eraser')} shortcut="0">
                        <Eraser className="size-4" aria-hidden />
                    </ToolButton>
                </div>
                <span className="size-9" aria-hidden />
            </div>
            <div className="relative flex h-32 items-center justify-center">
                <div className="relative rounded-md border-2 border-skrum-col-sun-border bg-skrum-col-sun px-5 py-6 text-sm">
                    <span className="text-foreground">{t('Sprint goal')}</span>
                    <span
                        aria-hidden
                        className="absolute -inset-1 border border-primary"
                    />
                    {[
                        '-top-1.5 -left-1.5',
                        '-top-1.5 -right-1.5',
                        '-bottom-1.5 -left-1.5',
                        '-right-1.5 -bottom-1.5',
                    ].map((position) => (
                        <span
                            key={position}
                            aria-hidden
                            className={cn(
                                'absolute size-2 rounded-xs border border-primary bg-card',
                                position,
                            )}
                        />
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-raised">
                    <ToolButton label={t('Undo')}>
                        <Undo2 className="size-4" aria-hidden />
                    </ToolButton>
                    <ToolButton label={t('Redo')} disabled>
                        <Redo2 className="size-4" aria-hidden />
                    </ToolButton>
                </div>
                <p className="hidden min-w-0 flex-1 truncate text-center text-xs text-muted-foreground sm:block">
                    {t(
                        'To move canvas, hold mouse wheel or spacebar while dragging, or use the hand tool',
                    )}
                </p>
            </div>
        </div>
    );
}

function PaletteTable() {
    const names = useColorNames();
    const { t } = useTrans();

    return (
        <ul
            aria-label={t('Stored scene colours')}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
            {PostItColors.map((color) => (
                <li
                    key={color}
                    className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-2 text-sm"
                >
                    <span
                        aria-hidden
                        className="size-8 shrink-0 rounded-md border-2"
                        style={{
                            backgroundColor: POSTIT[color].bg,
                            borderColor: POSTIT[color].stroke,
                        }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                        {names[color]}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {POSTIT[color].bg} / {POSTIT[color].stroke}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function Interactive() {
    const [color, setColor] = useState<PostItColor>('sun');

    return <WhiteboardColorBar value={color} onChange={setColor} />;
}

export default function WhiteboardThemeSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Excalidraw UI, light (active tool, tool hover, selection frame, disabled redo, hint)',
                )}
            >
                <CanvasMock />
            </Example>
            <Example label={t('Excalidraw UI, dark')}>
                <CanvasMock dark />
            </Example>
            <Example label={t('Fill palette: the eight post-it colours')}>
                <PaletteTable />
            </Example>
            <Example label={t('Fallback colour bar, active swatch')}>
                <Interactive />
            </Example>
            <Example label={t('Fallback colour bar, vertical')}>
                <WhiteboardColorBar
                    value="lagoon"
                    onChange={noop}
                    orientation="vertical"
                />
            </Example>
            <Example
                label={t('Fallback colour bar, nothing selected (disabled)')}
            >
                <WhiteboardColorBar value="sun" onChange={noop} disabled />
            </Example>
            <Example label={t('Fallback colour bar, dark')}>
                <div className="dark rounded-lg bg-skrum-canvas p-3">
                    <WhiteboardColorBar value="plum" onChange={noop} />
                </div>
            </Example>
        </div>
    );
}
