import { Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronDown, Search } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { EmptyState } from '@/components/skrum/empty-state';
import { PokerRounds } from '@/components/skrum/poker-rounds';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Pagination,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { EstimatedTaskRow, TeamSummary, WorkspaceSummary } from '@/types';
import { TicketClasses } from './task-source';

const AllGames = 'all';
const VisibleVoters = 3;
const TableFrom = 768;
const ColumnCount = 6;

type Filters = { game: string | null; q: string };

export type EstimationHistoryProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    games: { id: string; title: string }[];
    filters: Filters;
    tasks: EstimatedTaskRow[];
    pagination: { currentPage: number; lastPage: number; total: number };
    /** The whole history of the team, whatever the filters: the games that hold an estimate. */
    summary: { gamesCount: number };
    /** Place of the page actions, at the end of the heading (the export of a later plan). */
    actions?: ReactNode;
    /** Place of further filters, after the game filter (deck, period, voted again). */
    extraFilters?: ReactNode;
};

function filterQuery(filters: Filters, page?: number): Record<string, string> {
    return {
        ...(filters.game ? { game: filters.game } : {}),
        ...(filters.q.trim() !== '' ? { q: filters.q.trim() } : {}),
        ...(page && page > 1 ? { page: String(page) } : {}),
    };
}

/** Day and month, with the year when it is not the year of `now`. */
export function formatEstimateDate(
    iso: string,
    locale: string,
    now: Date = new Date(),
): string {
    const date = new Date(iso);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === now.getFullYear()
            ? {}
            : { year: 'numeric' }),
    }).format(date);
}

/**
 * First and last row of the page. The server sends no page size: every page
 * but the last is full, and the last one ends on the total.
 */
export function pageRange(
    pagination: EstimationHistoryProps['pagination'],
    rows: number,
): { from: number; to: number } {
    if (pagination.currentPage >= pagination.lastPage) {
        return { from: pagination.total - rows + 1, to: pagination.total };
    }

    const from = (pagination.currentPage - 1) * rows + 1;

    return { from, to: from + rows - 1 };
}

function SearchForm({
    initial,
    onSearch,
}: {
    initial: string;
    onSearch: (search: string) => void;
}) {
    const { t } = useTrans();
    const [search, setSearch] = useState(initial);

    const submit = (event: FormEvent): void => {
        event.preventDefault();
        onSearch(search);
    };

    return (
        <form
            role="search"
            onSubmit={submit}
            className="flex min-w-0 flex-auto basis-52 gap-2"
        >
            <div className="relative min-w-0 flex-1">
                <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                    type="search"
                    value={search}
                    placeholder={t('Search tasks')}
                    aria-label={t('Search tasks')}
                    className="h-8 pl-8"
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>
            <Button
                type="submit"
                variant="outline"
                size="sm"
                className="max-w-full min-w-0 shrink-0"
            >
                <span className="truncate">{t('Search')}</span>
            </Button>
        </form>
    );
}

function TaskTitle({ task }: { task: EstimatedTaskRow }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold wrap-anywhere text-foreground">
                {task.title}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                {task.ticketKey !== null && (
                    <Badge
                        variant="outline"
                        data-slot="estimate-ticket"
                        className={cn(TicketClasses, 'max-w-full')}
                    >
                        <span className="truncate">{task.ticketKey}</span>
                    </Badge>
                )}
                <span className="min-w-0 text-xs wrap-anywhere text-muted-foreground">
                    {task.gameTitle}
                </span>
            </span>
        </div>
    );
}

function EstimateValue({ value }: { value: string }) {
    return (
        <span
            data-slot="estimate-value"
            className="inline-grid h-7 max-w-24 min-w-8 place-items-center rounded-md bg-skrum-primary-soft px-1.5 font-display text-ui-lg font-bold text-skrum-primary-text"
        >
            <span className="max-w-full truncate">{value}</span>
        </span>
    );
}

function Voters({ task }: { task: EstimatedTaskRow }) {
    const { t } = useTrans();

    return (
        <span
            data-slot="estimate-voters"
            className="inline-flex items-center gap-2 whitespace-nowrap"
        >
            {task.voters.length > 0 && (
                <AvatarStack
                    size="xs"
                    max={VisibleVoters}
                    people={task.voters
                        .slice(0, VisibleVoters)
                        .map((voter) => ({
                            name: voter.name,
                            src: voter.avatarUrl,
                        }))}
                />
            )}
            <span aria-hidden="true" className="text-muted-foreground">
                {task.votersCount}
            </span>
            <span className="sr-only">
                {t(':count voters', { count: task.votersCount })}
            </span>
        </span>
    );
}

function RoundsToggle({
    task,
    open,
    panelId,
    onToggle,
}: {
    task: EstimatedTaskRow;
    open: boolean;
    panelId: string;
    onToggle: () => void;
}) {
    const { t } = useTrans();
    const revoted = task.roundsCount > 1;

    return (
        <span
            data-slot="estimate-rounds"
            data-revoted={revoted || undefined}
            className="inline-flex items-center gap-1 whitespace-nowrap"
        >
            {revoted ? (
                <Badge variant="warning" shape="pill">
                    {task.roundsCount}
                </Badge>
            ) : (
                <span className="px-2 text-muted-foreground">
                    {task.roundsCount}
                </span>
            )}
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={open ? t('Hide rounds') : t('Show rounds')}
                onClick={onToggle}
            >
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        'transition-transform duration-220 ease-standard motion-reduce:transition-none',
                        open && 'rotate-180',
                    )}
                />
            </Button>
        </span>
    );
}

function RoundsPanel({
    task,
    locale,
    onClose,
}: {
    task: EstimatedTaskRow;
    locale: string;
    onClose: () => void;
}) {
    return (
        <PokerRounds
            rounds={task.rounds}
            players={task.players}
            count={task.roundsCount}
            locale={locale}
            statistics
            open
            onOpenChange={(next) => {
                if (!next) {
                    onClose();
                }
            }}
        />
    );
}

export function EstimationHistory({
    workspace,
    team,
    games,
    filters,
    tasks,
    pagination,
    summary,
    actions,
    extraFilters,
}: EstimationHistoryProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const wide = useMinWidth(TableFrom);
    const [expanded, setExpanded] = useState<string | null>(null);
    const params = { workspace: workspace.slug, team: team.id };
    const filtered = filters.game !== null || filters.q !== '';
    const range = pageRange(pagination, tasks.length);

    const apply = (changes: Partial<Filters>): void => {
        router.get(
            TeamEstimatesController.index.url(params, {
                query: filterQuery({ ...filters, ...changes }),
            }),
            {},
            { preserveState: true, replace: true },
        );
    };

    const pageUrl = (page: number): string =>
        TeamEstimatesController.index.url(params, {
            query: filterQuery(filters, page),
        });

    const toggle = (id: string): void => {
        setExpanded((current) => (current === id ? null : id));
    };

    const summaryLine = (): string => {
        if (filtered || pagination.total === 0) {
            return team.name;
        }

        if (pagination.total === 1) {
            return t('1 task estimated by :team in 1 game', {
                team: team.name,
            });
        }

        return summary.gamesCount === 1
            ? t(':count tasks estimated by :team in 1 game', {
                  count: pagination.total,
                  team: team.name,
              })
            : t(':count tasks estimated by :team across :games games', {
                  count: pagination.total,
                  team: team.name,
                  games: summary.gamesCount,
              });
    };

    return (
        <div
            data-slot="estimation-history"
            className="flex min-w-0 flex-col gap-5"
        >
            <Link
                href={TeamsController.show(params)}
                className="flex max-w-full items-center gap-2 self-start rounded-sm text-body-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <ArrowLeft aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{t('Back to the team')}</span>
            </Link>

            <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="font-display text-2xl font-bold tracking-heading">
                        {t('Estimation history')}
                    </h1>
                    <p className="text-sm wrap-anywhere text-muted-foreground">
                        {summaryLine()}
                    </p>
                </div>
                <div
                    data-slot="estimation-history-actions"
                    className="flex min-w-0 flex-wrap items-center gap-2 empty:hidden"
                >
                    {actions}
                </div>
            </div>

            <div
                data-slot="estimation-history-filters"
                className="flex min-w-0 flex-wrap items-center gap-2"
            >
                <SearchForm
                    key={filters.q}
                    initial={filters.q}
                    onSearch={(q) => apply({ q })}
                />
                <Select
                    value={filters.game ?? AllGames}
                    onValueChange={(value) =>
                        apply({ game: value === AllGames ? null : value })
                    }
                >
                    <SelectTrigger
                        size="sm"
                        aria-label={t('Game')}
                        className="max-w-full min-w-0 text-body-sm sm:max-w-64"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={AllGames}>
                            {t('All games')}
                        </SelectItem>
                        {games.map((game) => (
                            <SelectItem key={game.id} value={game.id}>
                                {game.title}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {extraFilters}
            </div>

            {tasks.length === 0 && (
                <EmptyState
                    module="poker"
                    title={t('No estimated tasks yet.')}
                    description={
                        filtered
                            ? t('No task matches this search or this game.')
                            : t(
                                  'A task is listed here once its estimate is saved in a game.',
                              )
                    }
                    action={
                        filtered
                            ? {
                                  label: t('Clear filters'),
                                  variant: 'outline',
                                  onClick: () => apply({ game: null, q: '' }),
                              }
                            : undefined
                    }
                />
            )}

            {tasks.length > 0 && wide && (
                <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card">
                    <Table className="text-body-sm">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-full">
                                    {t('Task')}
                                </TableHead>
                                <TableHead>{t('Estimate')}</TableHead>
                                <TableHead>{t('Deck')}</TableHead>
                                <TableHead>{t('Date')}</TableHead>
                                <TableHead>{t('Voters')}</TableHead>
                                <TableHead>{t('Rounds')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tasks.map((task) => {
                                const open = expanded === task.id;
                                const panelId = `estimate-rounds-${task.id}`;

                                return (
                                    <Fragment key={task.id}>
                                        <TableRow
                                            data-slot="estimate-row"
                                            className={cn(open && 'border-b-0')}
                                        >
                                            <TableCell className="w-full">
                                                <TaskTitle task={task} />
                                            </TableCell>
                                            <TableCell>
                                                <EstimateValue
                                                    value={task.estimate}
                                                />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                                {task.deck}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                                {formatEstimateDate(
                                                    task.estimatedAt,
                                                    locale,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Voters task={task} />
                                            </TableCell>
                                            <TableCell>
                                                <RoundsToggle
                                                    task={task}
                                                    open={open}
                                                    panelId={panelId}
                                                    onToggle={() =>
                                                        toggle(task.id)
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                        {open && (
                                            <TableRow
                                                id={panelId}
                                                className="bg-muted hover:bg-muted"
                                            >
                                                <TableCell
                                                    colSpan={ColumnCount}
                                                    className="text-sm"
                                                >
                                                    <RoundsPanel
                                                        task={task}
                                                        locale={locale}
                                                        onClose={() =>
                                                            setExpanded(null)
                                                        }
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            {tasks.length > 0 && !wide && (
                <ul
                    aria-label={t('Estimation history')}
                    className="flex min-w-0 flex-col gap-3"
                >
                    {tasks.map((task) => {
                        const open = expanded === task.id;
                        const panelId = `estimate-rounds-${task.id}`;

                        return (
                            <li
                                key={task.id}
                                data-slot="estimate-row"
                                className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground shadow-card"
                            >
                                <div className="flex min-w-0 items-start justify-between gap-3 text-sm">
                                    <TaskTitle task={task} />
                                    <EstimateValue value={task.estimate} />
                                </div>
                                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground">
                                    <span className="min-w-0 truncate">
                                        <span className="sr-only">
                                            {t('Deck')}:{' '}
                                        </span>
                                        {task.deck}
                                    </span>
                                    <span className="whitespace-nowrap">
                                        <span className="sr-only">
                                            {t('Date')}:{' '}
                                        </span>
                                        {formatEstimateDate(
                                            task.estimatedAt,
                                            locale,
                                        )}
                                    </span>
                                </div>
                                <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3 text-body-sm">
                                    <Voters task={task} />
                                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                                        <span>{t('Rounds')}</span>
                                        <RoundsToggle
                                            task={task}
                                            open={open}
                                            panelId={panelId}
                                            onToggle={() => toggle(task.id)}
                                        />
                                    </span>
                                </div>
                                {open && (
                                    <div id={panelId} className="min-w-0">
                                        <RoundsPanel
                                            task={task}
                                            locale={locale}
                                            onClose={() => setExpanded(null)}
                                        />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {tasks.length > 0 && (
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                    <span
                        data-slot="estimation-history-range"
                        className="text-muted-foreground tabular-nums"
                    >
                        {t(':from–:to of :total', {
                            from: range.from,
                            to: range.to,
                            total: pagination.total,
                        })}
                    </span>
                    {pagination.lastPage > 1 && (
                        <Pagination className="mx-0 w-auto min-w-24 flex-1 justify-end gap-2">
                            <PaginationPrevious
                                size="sm"
                                variant="outline"
                                disabled={pagination.currentPage <= 1}
                                href={pageUrl(pagination.currentPage - 1)}
                            />
                            <PaginationNext
                                size="sm"
                                variant="outline"
                                disabled={
                                    pagination.currentPage >=
                                    pagination.lastPage
                                }
                                href={pageUrl(pagination.currentPage + 1)}
                            />
                        </Pagination>
                    )}
                </div>
            )}
        </div>
    );
}
