import type { RetroPhase } from './types';

export type ActivityKind = 'writing' | 'moving' | 'notes';

export type ActivityMessage = {
    kind: ActivityKind;
    /** A column (writing), a card (moving) or the lead card of a topic (notes). */
    targetId: string;
    active: boolean;
};

export type ActivityEntry = {
    senderId: string;
    kind: ActivityKind;
    targetId: string;
    expiresAt: number;
};

/** A receiver forgets an entry this long after its last message. */
export const ActivityTtlMs = 5000;

/** A sender repeats an ongoing activity at most this often. */
export const ActivityRefreshMs = 2000;

/** Anonymous retro: the writing heartbeat to the server (spec §6.11 rule 1). */
export const WritingHeartbeatMs = 3000;

/** Anonymous retro: a count not refreshed for this long is dropped (rule 5). */
export const WritingCountTtlMs = 8000;

export type WritingCount = { count: number; receivedAt: number };

const Kinds: ActivityKind[] = ['writing', 'moving', 'notes'];

export function parseActivity(raw: unknown): ActivityMessage | null {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }

    const { kind, targetId, active } = raw as Record<string, unknown>;

    if (!Kinds.includes(kind as ActivityKind)) {
        return null;
    }

    if (typeof targetId !== 'string' || targetId === '') {
        return null;
    }

    if (typeof active !== 'boolean') {
        return null;
    }

    return { kind: kind as ActivityKind, targetId, active };
}

/**
 * Which client events a phase takes. On an anonymous retro `writing` is never
 * a client event — its presence id and column would tie the hidden card to
 * its author — and goes through the server as a count (spec §6.11).
 */
export function kindsShownIn(
    phase: RetroPhase,
    isAnonymous: boolean,
): ActivityKind[] {
    if (phase === 'writing') {
        return isAnonymous ? ['moving'] : ['writing', 'moving'];
    }

    if (phase === 'grouping') {
        return ['moving'];
    }

    if (phase === 'discussing') {
        return ['notes'];
    }

    return [];
}

export function applyActivity(
    entries: ActivityEntry[],
    senderId: string,
    message: ActivityMessage,
    now: number,
): ActivityEntry[] {
    const isSame = (entry: ActivityEntry): boolean =>
        entry.senderId === senderId && entry.kind === message.kind;
    const others = entries.filter((entry) => !isSame(entry));

    if (!message.active) {
        return others;
    }

    const next: ActivityEntry = {
        senderId,
        kind: message.kind,
        targetId: message.targetId,
        expiresAt: now + ActivityTtlMs,
    };
    const index = entries.findIndex(
        (entry) => isSame(entry) && entry.targetId === message.targetId,
    );

    if (index === -1) {
        return [...others, next];
    }

    // A refresh keeps its place: names are listed in the order people started.
    return entries.flatMap((entry, position) => {
        if (position === index) {
            return [next];
        }

        return isSame(entry) ? [] : [entry];
    });
}

export function liveActivity(
    entries: ActivityEntry[],
    now: number,
): ActivityEntry[] {
    return entries.filter((entry) => entry.expiresAt > now);
}

/** How many other people are writing on an anonymous retro (spec §6.11 rule 5). */
export function othersWriting(
    last: WritingCount | null,
    viewerIsWriting: boolean,
    now: number,
): number {
    if (last === null || now - last.receivedAt >= WritingCountTtlMs) {
        return 0;
    }

    return Math.max(0, last.count - (viewerIsWriting ? 1 : 0));
}

export function activityNames(
    entries: ActivityEntry[],
    kind: ActivityKind,
    targetId: string,
    nameOf: (senderId: string) => string,
): string[] {
    return entries
        .filter((entry) => entry.kind === kind && entry.targetId === targetId)
        .map((entry) => nameOf(entry.senderId));
}

/** The rule of the live cursors: the name, "Participant" on an anonymous retro. */
export function activityLabel(
    member: { id: string; name: string } | undefined,
    isAnonymous: boolean,
    t: (key: string) => string,
): string {
    if (isAnonymous || member === undefined) {
        return t('Participant');
    }

    return member.name;
}
