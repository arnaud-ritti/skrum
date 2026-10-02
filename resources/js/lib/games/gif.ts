import type {
    GameGifPending,
    GameGifRevealed,
    GameGifSlot,
    GameRound,
} from './types';

function isRevealedAnswer(answer: GameGifSlot): answer is GameGifRevealed {
    return 'id' in answer;
}

export function pendingAnswers(round: GameRound): GameGifPending[] {
    return (round.answers ?? []).filter(
        (answer): answer is GameGifPending => !isRevealedAnswer(answer),
    );
}

export function revealedAnswers(round: GameRound): GameGifRevealed[] {
    return (round.answers ?? []).filter(isRevealedAnswer);
}

export function withPendingAnswer(
    answers: GameGifPending[],
    playerId: string,
    answered: boolean,
): GameGifPending[] {
    const others = answers.filter((answer) => answer.playerId !== playerId);

    return answered ? [...others, { playerId, answered: true }] : others;
}

export function withVoter(
    voters: string[],
    playerId: string,
    voted: boolean,
): string[] {
    const others = voters.filter((voter) => voter !== playerId);

    return voted ? [...others, playerId] : others;
}
