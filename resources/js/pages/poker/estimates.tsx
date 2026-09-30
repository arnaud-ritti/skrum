import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState, type FormEvent } from 'react';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { formatAverage } from '@/lib/poker/format';
import type { PokerRound } from '@/lib/poker/types';
import type { EstimatedTaskRow, TeamSummary, WorkspaceSummary } from '@/types';

const AllGames = 'all';

type Filters = { game: string | null; q: string };

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    games: { id: string; title: string }[];
    filters: Filters;
    tasks: EstimatedTaskRow[];
    pagination: { currentPage: number; lastPage: number; total: number };
};

function filterQuery(filters: Filters, page?: number) {
    return {
        ...(filters.game ? { game: filters.game } : {}),
        ...(filters.q.trim() !== '' ? { q: filters.q.trim() } : {}),
        ...(page && page > 1 ? { page } : {}),
    };
}

export default function PokerEstimates({
    workspace,
    team,
    games,
    filters,
    tasks,
    pagination,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [search, setSearch] = useState(filters.q);
    const [expanded, setExpanded] = useState<string | null>(null);
    const params = { workspace: workspace.slug, team: team.id };
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
    });

    const apply = (changes: Partial<Filters>) => {
        router.get(
            TeamEstimatesController.index.url(params, {
                query: filterQuery({ ...filters, ...changes }),
            }),
            {},
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        apply({ q: search });
    };

    const pageUrl = (page: number) =>
        TeamEstimatesController.index.url(params, {
            query: filterQuery(filters, page),
        });

    return (
        <>
            <Head title={t('Estimation history')} />
            <div className="space-y-6 p-4">
                <Heading
                    title={t('Estimation history')}
                    description={team.name}
                />

                <Link
                    href={TeamsController.show(params)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                >
                    {t('Back to the team')}
                </Link>

                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={filters.game ?? AllGames}
                        onValueChange={(value) =>
                            apply({ game: value === AllGames ? null : value })
                        }
                    >
                        <SelectTrigger className="w-56" aria-label={t('Game')}>
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
                    <form onSubmit={submitSearch} className="flex gap-2">
                        <Input
                            type="search"
                            value={search}
                            placeholder={t('Search tasks')}
                            aria-label={t('Search tasks')}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <Button type="submit" variant="outline">
                            {t('Search')}
                        </Button>
                    </form>
                </div>

                {tasks.length === 0 ? (
                    <p className="text-muted-foreground">
                        {t('No estimated tasks yet.')}
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-left">
                                <tr>
                                    <th className="p-2" />
                                    <th className="p-2 font-medium">
                                        {t('Task')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Game')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Estimate')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Rounds')}
                                    </th>
                                    <th className="p-2 font-medium">
                                        {t('Date')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {tasks.map((task) => {
                                    const isOpen = expanded === task.id;

                                    return (
                                        <Fragment key={task.id}>
                                            <tr>
                                                <td className="p-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        aria-expanded={isOpen}
                                                        aria-label={
                                                            isOpen
                                                                ? t(
                                                                      'Hide rounds',
                                                                  )
                                                                : t(
                                                                      'Show rounds',
                                                                  )
                                                        }
                                                        onClick={() =>
                                                            setExpanded(
                                                                isOpen
                                                                    ? null
                                                                    : task.id,
                                                            )
                                                        }
                                                    >
                                                        {isOpen ? (
                                                            <ChevronDown className="size-4" />
                                                        ) : (
                                                            <ChevronRight className="size-4" />
                                                        )}
                                                    </Button>
                                                </td>
                                                <td className="p-2 font-medium">
                                                    {task.title}
                                                </td>
                                                <td className="p-2">
                                                    {task.gameTitle}
                                                </td>
                                                <td className="p-2">
                                                    <Badge variant="secondary">
                                                        {task.estimate}
                                                    </Badge>
                                                </td>
                                                <td className="p-2">
                                                    {task.roundsCount}
                                                </td>
                                                <td className="p-2 whitespace-nowrap">
                                                    {formatDate.format(
                                                        new Date(
                                                            task.estimatedAt,
                                                        ),
                                                    )}
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr>
                                                    <td
                                                        colSpan={6}
                                                        className="bg-muted/30 p-3"
                                                    >
                                                        <RoundList
                                                            task={task}
                                                            locale={locale}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination.lastPage > 1 && (
                    <nav
                        className="flex items-center justify-between gap-2 text-sm"
                        aria-label={t('Pagination')}
                    >
                        {pagination.currentPage > 1 ? (
                            <Link
                                href={pageUrl(pagination.currentPage - 1)}
                                preserveScroll
                            >
                                {t('Previous')}
                            </Link>
                        ) : (
                            <span />
                        )}
                        <span className="text-muted-foreground">
                            {t('Page :page of :total', {
                                page: pagination.currentPage,
                                total: pagination.lastPage,
                            })}
                        </span>
                        {pagination.currentPage < pagination.lastPage ? (
                            <Link
                                href={pageUrl(pagination.currentPage + 1)}
                                preserveScroll
                            >
                                {t('Next')}
                            </Link>
                        ) : (
                            <span />
                        )}
                    </nav>
                )}
            </div>
        </>
    );
}

function RoundList({
    task,
    locale,
}: {
    task: EstimatedTaskRow;
    locale: string;
}) {
    const { t } = useTrans();
    const nameOf = (playerId: string) =>
        task.players.find((player) => player.id === playerId)?.name ??
        t('Former member');

    return (
        <ul className="space-y-3">
            {task.rounds.map((round) => (
                <li key={round.id} className="space-y-1">
                    <p className="font-medium">
                        {t('Round :number', { number: round.number })}
                    </p>
                    {round.anonymous ? (
                        <p className="text-muted-foreground">
                            {t('Anonymous votes')}
                        </p>
                    ) : (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1">
                            {round.votes.map((vote) => (
                                <li key={vote.playerId}>
                                    {nameOf(vote.playerId)}:{' '}
                                    <span className="font-mono">
                                        {vote.value ?? '—'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <RoundResult round={round} locale={locale} />
                </li>
            ))}
        </ul>
    );
}

function RoundResult({ round, locale }: { round: PokerRound; locale: string }) {
    const { t } = useTrans();
    const result = round.result;

    if (result === null) {
        return null;
    }

    return (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
            {result.distribution.map((entry) => (
                <span key={entry.value} className="font-mono">
                    {entry.value} × {entry.count}
                </span>
            ))}
            {result.average !== null && (
                <span>
                    {t('Average')}: {formatAverage(result.average, locale)}
                </span>
            )}
            {result.average === null && result.mode.length > 0 && (
                <span>
                    {t('Most played: :cards', {
                        cards: result.mode.join(', '),
                    })}
                </span>
            )}
            {result.average === null && result.mode.length === 0 && (
                <span>{t('No countable votes')}</span>
            )}
            {result.consensus && (
                <Badge variant="outline">{t('Consensus')}</Badge>
            )}
        </p>
    );
}
