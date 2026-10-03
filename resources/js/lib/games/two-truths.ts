import { rotationAfter } from './rotation';
import { tellerCandidates } from './turns';
import type { GamePlayer } from './types';

export const StatementMaxLength = 120;

export const StatementCount = 3;

/** The server's rule (spec §6.8): three distinct statements, case ignored, and which one is the lie. */
export function canSaveStatements(
    statements: string[],
    lieIndex: number | null,
): boolean {
    if (lieIndex === null || lieIndex < 0 || lieIndex >= StatementCount) {
        return false;
    }

    const trimmed = statements.map((statement) => statement.trim());

    if (trimmed.length !== StatementCount) {
        return false;
    }

    if (
        trimmed.some(
            (statement) =>
                statement === '' || statement.length > StatementMaxLength,
        )
    ) {
        return false;
    }

    return (
        new Set(trimmed.map((statement) => statement.toLowerCase())).size ===
        StatementCount
    );
}

/**
 * "Order of tellers": the teller of the round in play, then the players whose
 * set is ready in the order Start proposes them (after the previous teller,
 * online first).
 */
export function tellerOrder(
    players: GamePlayer[],
    onlinePresenceIds: Set<string>,
    ready: string[],
    previousTellerId: string | null,
    currentTellerId: string | null,
): { order: string[]; current: string | null; next: string | null } {
    const onlineRotation = rotationAfter(
        players,
        currentTellerId ?? previousTellerId,
    )
        .filter((player) => onlinePresenceIds.has(player.presenceId))
        .map((player) => player.id);
    const coming = tellerCandidates(ready, onlineRotation).filter(
        (playerId) => playerId !== currentTellerId,
    );

    return {
        order: currentTellerId === null ? coming : [currentTellerId, ...coming],
        current: currentTellerId,
        next: coming[0] ?? null,
    };
}
