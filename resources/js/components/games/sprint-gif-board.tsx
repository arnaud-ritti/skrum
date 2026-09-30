import type { GameRound } from '@/lib/games/types';
import { GifAnswerStage } from './gif-answer-stage';
import { GifQuestionBanner } from './gif-question-banner';
import { GifVotingStage } from './gif-voting-stage';

export function SprintGifBoard({ round }: { round: GameRound }) {
    return (
        <div className="flex w-full max-w-3xl flex-col gap-6">
            <GifQuestionBanner round={round} />
            {round.revealedAt === null ? (
                <GifAnswerStage round={round} />
            ) : (
                <GifVotingStage round={round} />
            )}
        </div>
    );
}
