import { useId } from 'react';
import { ROTIWidget } from '@/components/skrum/roti-widget';
import { useTrans } from '@/hooks/use-trans';
import { toRotiResult } from '@/lib/retro/session-end';
import type { RotiResults } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { RotiVote } from '../phase-roti';

/**
 * The average and the distribution, shown once the session has ended. A
 * retro completed before the ROTI phase existed still takes a rating here.
 */
export function RotiResult({ roti }: { roti: RotiResults }) {
    const { t } = useTrans();
    const { board } = useBoard();
    const titleId = useId();

    return (
        <section
            aria-labelledby={titleId}
            data-slot="retro-roti-result"
            className="flex min-w-0 flex-col gap-4"
        >
            <h2 id={titleId} className="sr-only">
                {t('Return on time invested')}
            </h2>
            {board.roti.canVote && <RotiVote />}
            <ROTIWidget mode="result" result={toRotiResult(roti)} />
        </section>
    );
}
