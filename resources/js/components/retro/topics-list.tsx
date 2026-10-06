import { ArrowDownWideNarrow, Crosshair, ThumbsUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTrans } from '@/hooks/use-trans';
import type { Topic } from '@/lib/retro/topics';
import type { BoardColumn, ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

const FallbackColor: ColumnColor = 'moss';

export function topicColor(
    topic: Pick<Topic, 'columnId'>,
    columns: BoardColumn[],
): ColumnColor {
    return (
        columns.find((column) => column.id === topic.columnId)?.color ??
        FallbackColor
    );
}

/** The colour mark of the column a topic comes from. */
export function TopicSwatch({
    color,
    className,
}: {
    color: ColumnColor;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            data-slot="retro-topic-swatch"
            data-color={color}
            className={cn(
                columnColorClass(color),
                'size-2 shrink-0 rounded-xs bg-(--col-border) inset-ring inset-ring-(--col-text)',
                className,
            )}
        />
    );
}

export function TopicVotes({ votes }: { votes: number }) {
    const { t } = useTrans();

    return (
        <span
            data-slot="retro-topic-votes"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-bold whitespace-nowrap tabular-nums"
        >
            <ThumbsUp className="size-3 text-muted-foreground" aria-hidden />
            <span aria-hidden>{votes}</span>
            <span className="sr-only">
                {t(votes === 1 ? ':count vote' : ':count votes', {
                    count: votes,
                })}
            </span>
        </span>
    );
}

type Props = {
    topics: Topic[];
    columns: BoardColumn[];
    /** The topic the viewer looks at. */
    currentId: string | null;
    /** The topic the facilitator put in focus for everyone. */
    sharedId: string | null;
    /** How many action items the retro has so far. */
    actionCount: number;
    onSelect: (topic: Topic) => void;
    /**
     * The second line of a topic: the "discussed" mark, the action count and,
     * on the shared topic, "Now" and its time left (RT-5, RT-7, RT-8). Given,
     * it draws "Now" itself.
     */
    rowMeta?: (topic: Topic) => ReactNode;
    /** Place of the time left for the topics to come (RT-5). */
    estimate?: ReactNode;
    /** Replaces the last line, the action items so far: "5 min per topic · 3 actions so far" (RT-5). */
    summary?: ReactNode;
    className?: string;
};

/** The topics of the discussion, the most voted first. A press brings one in front of the viewer. */
export function TopicsList({
    topics,
    columns,
    currentId,
    sharedId,
    actionCount,
    onSelect,
    rowMeta,
    estimate,
    summary,
    className,
}: Props) {
    const { t } = useTrans();
    const currentIndex = topics.findIndex((topic) => topic.id === currentId);

    return (
        <aside
            aria-label={t('Topics')}
            data-slot="retro-topics-rail"
            className={cn(
                'flex min-w-0 flex-col border-b bg-background lg:border-r lg:border-b-0 xl:min-h-0',
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-2 px-4 pt-4 pb-2">
                <h2 className="truncate text-base font-title">{t('Topics')}</h2>
                <Badge variant="muted" shape="pill">
                    {topics.length}
                </Badge>
                <span className="ml-auto inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                    <ArrowDownWideNarrow
                        className="size-4 shrink-0"
                        aria-hidden
                    />
                    <span className="truncate">{t('By votes')}</span>
                </span>
            </div>
            <ol
                data-test="retro-topics"
                className="scrollbar-themed flex min-w-0 flex-col gap-0.5 px-2 pb-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto"
            >
                {topics.map((topic, index) => {
                    const isCurrent = topic.id === currentId;
                    const isShared = topic.id === sharedId;
                    const meta = rowMeta?.(topic);

                    return (
                        <li
                            key={topic.id}
                            data-topic-id={topic.id}
                            data-shared={isShared || undefined}
                            data-current={isCurrent || undefined}
                            className="min-w-0"
                        >
                            <button
                                type="button"
                                aria-current={isCurrent ? 'true' : undefined}
                                onClick={() => onSelect(topic)}
                                className={cn(
                                    'grid w-full min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 rounded-lg py-2.5 pr-3 pl-2 text-left outline-ring transition-colors duration-140 ease-standard hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
                                    isCurrent &&
                                        'bg-skrum-primary-soft inset-ring inset-ring-primary hover:bg-skrum-primary-soft',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex items-center gap-1 font-mono text-xs/5 font-semibold text-muted-foreground',
                                        isCurrent && 'text-skrum-primary-text',
                                    )}
                                >
                                    <TopicSwatch
                                        color={topicColor(topic, columns)}
                                    />
                                    {index + 1}
                                </span>
                                <span
                                    data-slot="retro-topic-title"
                                    className={cn(
                                        'line-clamp-3 min-w-0 text-body-sm font-medium wrap-anywhere',
                                        isCurrent && 'font-semibold',
                                    )}
                                >
                                    {topic.title || t('GIF')}
                                </span>
                                <TopicVotes votes={topic.votes} />
                                {(isShared || meta) && (
                                    <span className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground empty:hidden">
                                        {isShared && rowMeta === undefined && (
                                            <span className="inline-flex min-w-0 items-center gap-1 font-medium text-skrum-primary-text">
                                                <Crosshair
                                                    className="size-3 shrink-0"
                                                    aria-hidden
                                                />
                                                <span className="truncate">
                                                    {t('Now')}
                                                </span>
                                            </span>
                                        )}
                                        {meta}
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ol>
            {topics.length > 0 && (
                <div
                    data-slot="retro-topics-progress"
                    className="mt-auto flex min-w-0 shrink-0 flex-col gap-2 border-t p-4"
                >
                    <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold">
                            {t('Topic :current of :total', {
                                current: currentIndex + 1,
                                total: topics.length,
                            })}
                        </span>
                        {estimate}
                    </div>
                    <Progress
                        value={currentIndex + 1}
                        max={topics.length}
                        valueLabel=""
                        tone="primary"
                        aria-label={t('Topics')}
                        aria-valuetext={t('Topic :current of :total', {
                            current: currentIndex + 1,
                            total: topics.length,
                        })}
                    />
                    <span
                        data-slot="retro-topics-summary"
                        className="truncate text-xs text-muted-foreground"
                    >
                        {summary ??
                            (actionCount === 1
                                ? t('1 action so far')
                                : t(':count actions so far', {
                                      count: actionCount,
                                  }))}
                    </span>
                </div>
            )}
        </aside>
    );
}
