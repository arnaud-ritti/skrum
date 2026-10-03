import { HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { Snapshot } from '@/lib/retro/types';
import { useBoard } from './board-context';

/** The header offers the health check while one is attached to an open retro. */
export function showsHealthCheck(
    board: Pick<Snapshot, 'retro' | 'healthCheck'>,
): boolean {
    return board.healthCheck !== null && board.retro.phase !== 'completed';
}

/** What the button and the menu entry say: who sent out of who joined. */
function useHealthCheckEntry() {
    const { board } = useBoard();
    const { t } = useTrans();
    const { healthCheck } = board;

    if (healthCheck === null) {
        return null;
    }

    const { respondents: answered, participants: total } = healthCheck;

    return {
        count: `${answered}/${total}`,
        label: t('Health check, :answered of :total answered', {
            answered,
            total,
        }),
        awaitsViewer: !healthCheck.isClosed && !healthCheck.hasSubmitted,
    };
}

function TodoDot() {
    return (
        <span
            aria-hidden
            data-slot="health-check-todo"
            className="size-2 shrink-0 rounded-full bg-primary"
        />
    );
}

/** In the header actions, before Share. */
export function HealthCheckButton({ onOpen }: { onOpen: () => void }) {
    const { t } = useTrans();
    const entry = useHealthCheckEntry();

    if (entry === null) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={entry.label}
            aria-haspopup="dialog"
            onClick={onOpen}
            className="shrink-0"
        >
            <HeartPulse aria-hidden />
            <span className="sr-only xl:not-sr-only xl:truncate">
                {t('Health check')}
            </span>
            <span
                data-slot="health-check-count"
                className="font-mono text-xs text-muted-foreground tabular-nums"
            >
                {entry.count}
            </span>
            {entry.awaitsViewer && <TodoDot />}
        </Button>
    );
}

/** The same entry in the one menu of the header on a phone. */
export function HealthCheckMenuItem({ onSelect }: { onSelect: () => void }) {
    const { t } = useTrans();
    const entry = useHealthCheckEntry();

    if (entry === null) {
        return null;
    }

    return (
        <DropdownMenuItem aria-label={entry.label} onSelect={onSelect}>
            <HeartPulse aria-hidden />
            <span className="truncate">{t('Health check')}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {entry.count}
                </span>
                {entry.awaitsViewer && <TodoDot />}
            </span>
        </DropdownMenuItem>
    );
}
