import { MousePointer2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type LiveCursorAction = 'idle' | 'dragging' | 'drawing' | 'typing';

export type LiveCursorProps = {
    userId: string;
    name: string;
    presence: number;
    x: number;
    y: number;
    action?: LiveCursorAction;
    idle?: boolean;
    className?: string;
};

export type CursorLayerProps = {
    cursors: LiveCursorProps[];
    visible: boolean;
    viewport: { x: number; y: number; zoom: number };
    className?: string;
};

const maxNameLength = 16;
const maxCursors = 20;
const presenceCount = 12;

export function truncateCursorName(name: string): string {
    const characters = Array.from(name.trim());

    if (characters.length <= maxNameLength) {
        return characters.join('');
    }

    return `${characters.slice(0, maxNameLength - 1).join('')}…`;
}

function presenceIndex(presence: number): number {
    const rounded = Math.round(presence);

    return (
        ((((rounded - 1) % presenceCount) + presenceCount) % presenceCount) + 1
    );
}

export function LiveCursor({
    name,
    presence,
    x,
    y,
    action = 'idle',
    idle = false,
    className,
}: LiveCursorProps) {
    const { t } = useTrans();
    const index = presenceIndex(presence);
    const shortName = truncateCursorName(name);
    const actionLabel = {
        idle: null,
        dragging: t('moves'),
        drawing: t('draws'),
        typing: t('types'),
    }[action];
    const style = {
        '--cur': `var(--skrum-presence-${index})`,
        '--cur-fg': `var(--skrum-presence-${index}-foreground)`,
        transform: `translate(${x}px, ${y}px)`,
    } as CSSProperties;

    return (
        <div
            aria-hidden="true"
            data-slot="live-cursor"
            data-action={action}
            data-idle={idle ? '' : undefined}
            style={style}
            className={cn(
                'pointer-events-none absolute top-0 left-0 z-(--z-cursor) transition-[transform,opacity] duration-(--duration-fast) ease-linear motion-reduce:transition-none',
                idle && 'opacity-60',
                className,
            )}
        >
            <svg
                viewBox="0 0 18 18"
                className="size-4.5 drop-shadow-sm"
                focusable="false"
            >
                <path
                    d="M2 1.5 L2 15 L5.8 11.4 L8.4 17 L10.9 15.9 L8.4 10.4 L13.8 10.4 Z"
                    className="fill-(--cur) stroke-card"
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                />
            </svg>
            {!idle && (
                <span
                    data-slot="live-cursor-label"
                    className="-mt-1 ml-4 inline-block max-w-48 truncate rounded-full border border-card bg-(--cur) px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap text-(--cur-fg) shadow-sm"
                >
                    {actionLabel === null
                        ? shortName
                        : `${shortName} · ${actionLabel}`}
                </span>
            )}
        </div>
    );
}

export function CursorLayer({
    cursors,
    visible,
    viewport,
    className,
}: CursorLayerProps) {
    const { t } = useTrans();

    if (!visible) {
        if (cursors.length === 0) {
            return null;
        }

        return (
            <Badge
                variant="muted"
                role="status"
                data-slot="cursor-layer-hidden"
                className={cn('rounded-full', className)}
            >
                <MousePointer2 aria-hidden="true" />
                {cursors.length === 1
                    ? t('1 cursor hidden')
                    : t(':count cursors hidden', { count: cursors.length })}
            </Badge>
        );
    }

    const shown = cursors.slice(0, maxCursors).map((cursor) => ({
        ...cursor,
        x: (cursor.x - viewport.x) * viewport.zoom,
        y: (cursor.y - viewport.y) * viewport.zoom,
    }));

    return (
        <div
            aria-hidden="true"
            data-slot="cursor-layer"
            className={cn(
                'pointer-events-none absolute inset-0 z-(--z-cursor) overflow-hidden',
                className,
            )}
        >
            {shown.map((cursor) => (
                <LiveCursor key={cursor.userId} {...cursor} />
            ))}
        </div>
    );
}
