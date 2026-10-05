import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import type { BoardParticipant } from '@/lib/retro/types';
import { ResultsCard } from './results-card';

/** Everyone who joined the retro, guests marked as such. */
export function Participants({
    participants,
}: {
    participants: BoardParticipant[];
}) {
    const { t } = useTrans();

    return (
        <ResultsCard title={t('Thanks for participating')}>
            <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-3">
                {participants.map((participant) => (
                    <li
                        key={participant.id}
                        className="flex min-w-0 items-center gap-2 text-sm"
                    >
                        <PersonAvatar
                            name={participant.name}
                            src={participant.avatarUrl}
                            kind={participant.isGuest ? 'guest' : 'member'}
                            decorative
                        />
                        <span className="min-w-0 truncate">
                            {participant.name}
                        </span>
                        {participant.isGuest && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                                {t('Guest')}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </ResultsCard>
    );
}
