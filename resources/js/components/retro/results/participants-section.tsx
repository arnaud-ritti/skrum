import { useTrans } from '@/hooks/use-trans';
import type { BoardParticipant } from '@/lib/retro/types';
import { ResultsSection } from './results-section';

export function ParticipantsSection({
    participants,
}: {
    participants: BoardParticipant[];
}) {
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Thanks for participating')}>
            <ul className="flex flex-wrap gap-3">
                {participants.map((participant) => (
                    <li
                        key={participant.id}
                        className="flex items-center gap-2 text-sm"
                    >
                        <img
                            src={participant.avatarUrl}
                            alt=""
                            className="size-8 rounded-full bg-muted"
                        />
                        <span>{participant.name}</span>
                        {participant.isGuest && (
                            <span className="text-xs text-muted-foreground">
                                {t('Guest')}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </ResultsSection>
    );
}
