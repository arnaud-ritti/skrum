import type { GameLeaderboardRow, GamePlayer, GamePointsAward } from './types';

/** Same order as the server: points, then wins, then name (spec §4.7). */
function rankLeaderboard(
    rows: GameLeaderboardRow[],
    players: GamePlayer[],
): GameLeaderboardRow[] {
    const names = new Map(players.map((player) => [player.id, player.name]));

    return [...rows].sort(
        (first, second) =>
            second.points - first.points ||
            second.wins - first.wins ||
            (names.get(first.playerId) ?? '').localeCompare(
                names.get(second.playerId) ?? '',
            ),
    );
}

/** A round end adds one row per player who acted, 0 points included. */
export function withAwardedPoints(
    rows: GameLeaderboardRow[],
    awards: GamePointsAward[],
    players: GamePlayer[],
): GameLeaderboardRow[] {
    const byPlayer = new Map(rows.map((row) => [row.playerId, row]));

    for (const award of awards) {
        const row = byPlayer.get(award.playerId) ?? {
            playerId: award.playerId,
            points: 0,
            wins: 0,
            roundsPlayed: 0,
        };

        byPlayer.set(award.playerId, {
            ...row,
            points: row.points + award.points,
            wins: row.wins + (award.isWin ? 1 : 0),
            roundsPlayed: row.roundsPlayed + 1,
        });
    }

    return rankLeaderboard([...byPlayer.values()], players);
}
