import { useActivity } from '@/hooks/use-retro-activity';
import { useTrans } from '@/hooks/use-trans';
import {
    activityLabel,
    type ActivityEntry,
    type ActivityKind,
} from '@/lib/retro/activity';
import { presenceSlot } from '@/lib/whiteboard/presence-slot';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';

const presenceTextClasses = [
    'text-skrum-presence-1',
    'text-skrum-presence-2',
    'text-skrum-presence-3',
    'text-skrum-presence-4',
    'text-skrum-presence-5',
    'text-skrum-presence-6',
    'text-skrum-presence-7',
    'text-skrum-presence-8',
    'text-skrum-presence-9',
    'text-skrum-presence-10',
    'text-skrum-presence-11',
    'text-skrum-presence-12',
];

type Props = {
    kind: ActivityKind;
    /** A column (writing), a card (moving) or the lead card of a topic (notes). */
    targetId?: string;
    /** Any of these targets: the cards of a column, for `moving`. */
    targetIds?: string[];
    className?: string;
};

function useShownEntries(
    kind: ActivityKind,
    targetId?: string,
    targetIds?: string[],
): ActivityEntry[] {
    const { board } = useBoard();
    const { entries } = useActivity();

    if (kind === 'writing' && board.retro.isAnonymous) {
        return [];
    }

    const targets = new Set([
        ...(targetId === undefined ? [] : [targetId]),
        ...(targetIds ?? []),
    ]);

    return entries.filter(
        (entry) => entry.kind === kind && targets.has(entry.targetId),
    );
}

/** A host that counts its children (a column) adds the line only when it shows. */
export function useShowsActivity(
    kind: ActivityKind,
    targetId?: string,
    targetIds?: string[],
): boolean {
    return useShownEntries(kind, targetId, targetIds).length > 0;
}

/**
 * "Inès is writing a card…" with the trema in the first person's presence
 * colour (spec §6.9). On an anonymous retro writing is never shown here: the
 * presence stack carries the count alone (§6.11).
 */
export function ActivityLine({ kind, targetId, targetIds, className }: Props) {
    const { board, online } = useBoard();
    const { t } = useTrans();
    const { isAnonymous } = board.retro;
    const shown = useShownEntries(kind, targetId, targetIds);

    if (shown.length === 0) {
        return null;
    }

    const nameOf = (entry: ActivityEntry): string => {
        const member = online.find((person) => person.id === entry.senderId);
        const label = activityLabel(member, isAnonymous, t);

        if (isAnonymous || !member || member.isGuest) {
            return label;
        }

        return label.split(' ')[0];
    };
    const names = shown.map(nameOf);

    return (
        <div
            role="status"
            aria-live="polite"
            data-slot="retro-activity"
            data-kind={kind}
            className={cn(
                'flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground',
                className,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex items-center gap-px',
                    presenceTextClasses[presenceSlot(shown[0].senderId) - 1],
                )}
            >
                <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                <i className="size-1 animate-trema rounded-full bg-current [animation-delay:180ms] motion-reduce:animate-none" />
            </span>
            <span className="truncate">{sentence(kind, names, t)}</span>
        </div>
    );
}

function sentence(
    kind: ActivityKind,
    names: string[],
    t: ReturnType<typeof useTrans>['t'],
): string {
    const [first, second] = names;
    const others = names.length - 1;

    if (kind === 'notes') {
        return t(':name is taking notes…', { name: first });
    }

    if (kind === 'moving') {
        if (names.length === 1) {
            return t(':name is moving a card…', { name: first });
        }

        if (names.length === 2) {
            return t(':first and :second are moving cards…', {
                first,
                second,
            });
        }

        return t(':name and :count others are moving cards…', {
            name: first,
            count: others,
        });
    }

    if (names.length === 1) {
        return t(':name is writing a card…', { name: first });
    }

    if (names.length === 2) {
        return t(':first and :second are writing cards…', { first, second });
    }

    return t(':name and :count others are writing cards…', {
        name: first,
        count: others,
    });
}
