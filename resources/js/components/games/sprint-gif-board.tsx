import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type { GameRound } from '@/lib/games/types';
import { GifAnswerStage } from './gif-answer-stage';
import { GifQuestionBanner } from './gif-question-banner';
import { GifVotingStage } from './gif-voting-stage';

type Props = {
    round: GameRound;
    /** Place left under the chosen GIF for its caption (GM-3). */
    caption?: ReactNode;
};

/** A round of Sprint in one GIF: the question, then the picks or the gallery to vote on. */
export function SprintGifBoard({ round, caption }: Props) {
    const { t } = useTrans();
    const isPicking = round.revealedAt === null;

    return (
        <div
            data-slot="sprint-gif-board"
            className="flex w-full flex-col items-center gap-4"
        >
            <GifQuestionBanner
                round={round}
                hint={
                    isPicking
                        ? `${t('Pick a GIF that answers the question.')} ${t('GIFs stay hidden until the reveal.')}`
                        : t('Vote for your favourite GIF.')
                }
            />
            {isPicking ? (
                <GifAnswerStage round={round} caption={caption} />
            ) : (
                <GifVotingStage round={round} />
            )}
        </div>
    );
}
