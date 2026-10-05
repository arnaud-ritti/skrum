import { Link } from '@inertiajs/react';
import { ChartColumn, Layers, PenTool, Plus, Spade } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type CreateTileType = 'retro' | 'poker' | 'whiteboard' | 'survey';

type Props = {
    /** The address asking for the New session dialog on each type the viewer may create. */
    hrefs: Partial<Record<CreateTileType, string>>;
};

const Tiles: {
    type: CreateTileType;
    icon: LucideIcon;
    tone: string;
}[] = [
    {
        type: 'retro',
        icon: Layers,
        tone: 'border-skrum-col-coral-border bg-skrum-col-coral text-skrum-col-coral-text',
    },
    {
        type: 'poker',
        icon: Spade,
        tone: 'border-skrum-col-iris-border bg-skrum-col-iris text-skrum-col-iris-text',
    },
    {
        type: 'whiteboard',
        icon: PenTool,
        tone: 'border-skrum-col-lagoon-border bg-skrum-col-lagoon text-skrum-col-lagoon-text',
    },
    {
        type: 'survey',
        icon: ChartColumn,
        tone: 'border-skrum-col-sun-border bg-skrum-col-sun text-skrum-col-sun-text',
    },
];

/** The four creation tiles under the header of the team page (ScreenTeam). */
export function TeamCreateTiles({ hrefs }: Props) {
    const { t } = useTrans();
    const texts: Record<CreateTileType, { title: string; hint: string }> = {
        retro: {
            title: t('New retrospective'),
            hint: t('4L, Start/Stop/Continue…'),
        },
        poker: {
            title: t('New poker game'),
            hint: t('Fibonacci, T-shirt, custom'),
        },
        whiteboard: {
            title: t('New whiteboard'),
            hint: t('Free canvas, live cursors'),
        },
        survey: {
            title: t('New survey'),
            hint: t('Health check, team pulse'),
        },
    };
    const shown = Tiles.filter(({ type }) => hrefs[type] !== undefined);

    if (shown.length === 0) {
        return null;
    }

    return (
        <div
            data-slot="team-create-tiles"
            className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4"
        >
            {shown.map(({ type, icon: Icon, tone }) => (
                <Link
                    key={type}
                    href={hrefs[type]!}
                    preserveScroll
                    preserveState
                    className="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3 text-card-foreground shadow-card transition-shadow duration-140 ease-standard outline-none hover:border-input hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                    <span
                        aria-hidden
                        className={cn(
                            'grid size-10 shrink-0 place-items-center rounded-lg border',
                            tone,
                        )}
                    >
                        <Icon className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">
                            {texts[type].title}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {texts[type].hint}
                        </span>
                    </span>
                    <Plus
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                    />
                </Link>
            ))}
        </div>
    );
}
