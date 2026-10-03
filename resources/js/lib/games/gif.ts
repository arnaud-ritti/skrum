import type {
    GameGifPending,
    GameGifRevealed,
    GameGifSlot,
    GameMyGifAnswer,
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

/** `myAnswer` is shared with Guess who?, whose answer is a text. */
export function myGifAnswer(round: GameRound): GameMyGifAnswer | null {
    const answer = round.myAnswer ?? null;

    return answer !== null && 'gif' in answer ? answer : null;
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

/**
 * Whether the viewer may press the vote of a GIF: never their own; a vote
 * already given can always be taken back; a one-vote round moves its vote;
 * otherwise only while the budget lasts.
 */
export function canVoteFor(
    round: GameRound,
    answerId: string,
    myAnswerId: string | null,
): boolean {
    if (answerId === myAnswerId) {
        return false;
    }

    const myVotes = round.myVotes ?? [];

    if (myVotes.includes(answerId)) {
        return true;
    }

    const allowed = round.votesAllowed ?? 1;

    return allowed <= 1 || myVotes.length < allowed;
}

/** The GIFs of a closed round by rank (ties share one), then by id; unranked last. */
export function rankedAnswers(answers: GameGifRevealed[]): GameGifRevealed[] {
    return [...answers].sort((first, second) => {
        const byRank =
            (first.rank ?? Number.POSITIVE_INFINITY) -
            (second.rank ?? Number.POSITIVE_INFINITY);

        if (byRank !== 0 && !Number.isNaN(byRank)) {
            return byRank;
        }

        return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
    });
}

/** The authors of rank one win, as long as their GIF got a vote (spec §6.7). */
export function isWinningAnswer(answer: GameGifRevealed): boolean {
    return answer.rank === 1 && (answer.votes ?? 0) > 0;
}
