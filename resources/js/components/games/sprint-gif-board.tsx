import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { GifAnswerStage } from './gif-answer-stage';
import { QuestionBanner } from './question-banner';
import { GifVotingStage } from './gif-voting-stage';

type Props = {
    round: GameRound;
};

/** A round of Sprint in one GIF: the question, then the picks or the gallery to vote on. */
export function SprintGifBoard({ round }: Props) {
    const { t } = useTrans();
    const isPicking = round.revealedAt === null;

    return (
        <div
            data-slot="sprint-gif-board"
            className="flex w-full flex-col items-center gap-4"
        >
            <QuestionBanner
                round={round}
                hint={
                    isPicking
                        ? `${t('Pick a GIF that answers the question.')} ${t('GIFs stay hidden until the reveal.')}`
                        : t('Vote for your favourite GIF.')
                }
            />
            {isPicking ? (
                <GifAnswerStage round={round} />
            ) : (
                <GifVotingStage round={round} />
            )}
        </div>
    );
}
