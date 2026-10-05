import type {
    HealthCheckResult,
    HealthCheckSummary,
} from '@/components/skrum/health-check-results';
import type { Roti, ROTIResult } from '@/components/skrum/roti-widget';
import type { TrackerProviderKey } from '@/types/integrations';
import type { ActionItem, HealthResults, RotiResults, Snapshot } from './types';

type SessionEndStats = {
    actions: number;
    participants: number;
    expected: number;
    /** Between 0 and 1; `null` when nobody is expected. */
    participationRatio: number | null;
    cards: number;
    groups: number;
    votesCast: number;
    votesAvailable: number;
};

/**
 * The five figures of the session end. Cards, groups and action items are
 * counted from what the board already holds; the rest comes from the server.
 */
export function sessionEndStats(
    board: Pick<Snapshot, 'cards' | 'actionItems' | 'results'>,
): SessionEndStats | null {
    if (board.results === null) {
        return null;
    }

    const { stats } = board.results;
    const { participants, expected } = stats.participation;
    const leads = new Set(
        board.cards.flatMap((card) =>
            card.parentCardId === null ? [] : [card.parentCardId],
        ),
    );

    return {
        actions: board.actionItems.length,
        participants,
        expected,
        participationRatio:
            expected === 0 ? null : Math.min(1, participants / expected),
        cards: board.cards.length,
        groups: leads.size,
        votesCast: stats.votesCast,
        votesAvailable: stats.votesAvailable,
    };
}

const SecondsPerMinute = 60;
const MinutesPerHour = 60;

/** "58 min", "1 h 12 min", "2 h": the hour sign is the same in every language. */
export function formatSessionDuration(seconds: number, locale: string): string {
    const totalMinutes = Math.max(1, Math.round(seconds / SecondsPerMinute));
    const hours = Math.floor(totalMinutes / MinutesPerHour);
    const minutes = totalMinutes % MinutesPerHour;
    const minutesText = new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: 'minute',
        unitDisplay: 'short',
    }).format(minutes);

    if (hours === 0) {
        return minutesText;
    }

    const hoursText = `${new Intl.NumberFormat(locale).format(hours)} h`;

    return minutes === 0 ? hoursText : `${hoursText} ${minutesText}`;
}

const Scores: Roti[] = [1, 2, 3, 4, 5];

export function toRotiResult(
    roti: RotiResults,
    previousAverage: number | null = null,
): ROTIResult {
    const distribution = Object.fromEntries(
        Scores.map((score) => [
            score,
            roti.distribution.find((row) => row.score === score)?.count ?? 0,
        ]),
    ) as Record<Roti, number>;

    return {
        mean: roti.average,
        votes: roti.respondents,
        distribution,
        ...(previousAverage === null ? {} : { previousMean: previousAverage }),
    };
}

export function toHealthResults(health: HealthResults): {
    respondents: number;
    participants: number;
    results: HealthCheckResult[];
    summary: HealthCheckSummary;
} {
    return {
        respondents: health.participation.respondents,
        participants: health.participation.participants,
        results: health.statements.map((statement) => ({
            key: statement.key,
            label: statement.label,
            text: statement.text,
            average: statement.average,
            count: statement.count,
            previousAverage: statement.previousAverage,
            distribution: statement.distribution,
        })),
        summary: {
            score: health.score,
            topStrength: health.topStrength && {
                label: health.topStrength.label,
                average: health.topStrength.average,
            },
            growthArea: health.growthArea && {
                label: health.growthArea.label,
                average: health.growthArea.average,
            },
            alignment: {
                value: health.alignment.value,
                label: health.alignment.label,
            },
            assessment: {
                title: health.assessment.title,
                sentence: health.assessment.sentence,
            },
        },
    };
}

/**
 * What the header of the actions says of the list: how many items have a
 * ticket, in which tracker when it is the same for all, and whether every
 * item has an owner and a due date.
 */
export function linkedItemsSummary(
    items: Pick<ActionItem, 'externalLinks' | 'assignee' | 'dueOn'>[],
): {
    linked: number;
    tracker: TrackerProviderKey | null;
    allOwnedAndDated: boolean;
} {
    const linked = items.filter(
        (item) => (item.externalLinks ?? []).length > 0,
    );
    const trackers = new Set(
        linked.flatMap((item) =>
            (item.externalLinks ?? []).map((link) => link.source),
        ),
    );

    return {
        linked: linked.length,
        tracker: trackers.size === 1 ? [...trackers][0] : null,
        allOwnedAndDated:
            items.length > 0 &&
            items.every(
                (item) => item.assignee !== null && item.dueOn !== null,
            ),
    };
}
