import type { PhaseDurations, TimedPhase } from './types';

export type { PhaseDurations, TimedPhase };

/** `PhaseDurations::TimedPhases`, in the order of the phases. */
export const TimedPhases: readonly TimedPhase[] = [
    'writing',
    'grouping',
    'voting',
    'discussing',
    'actions',
];

export const StandardDurations: Required<PhaseDurations> = {
    writing: 7,
    grouping: 5,
    voting: 3,
    discussing: 15,
    actions: 5,
};

export const MaxPhaseMinutes = 60;

export type PhaseTimerChoice = 'none' | 'standard' | 'custom';

export function choiceOf(durations: PhaseDurations | null): PhaseTimerChoice {
    if (durations === null || Object.keys(durations).length === 0) {
        return 'none';
    }

    const isStandard = TimedPhases.every(
        (phase) => durations[phase] === StandardDurations[phase],
    );

    return isStandard ? 'standard' : 'custom';
}

/** The payload: null when no phase is timed, otherwise the phases with minutes. */
export function toPayload(durations: PhaseDurations): PhaseDurations | null {
    const kept: PhaseDurations = {};

    for (const phase of TimedPhases) {
        const minutes = durations[phase] ?? 0;

        if (minutes >= 1) {
            kept[phase] = minutes;
        }
    }

    return Object.keys(kept).length === 0 ? null : kept;
}

/** What a choice of the "Timer per phase" select sends; `custom` reads the steppers. */
export function durationsFor(
    choice: PhaseTimerChoice,
    custom: PhaseDurations,
): PhaseDurations | null {
    if (choice === 'none') {
        return null;
    }

    if (choice === 'standard') {
        return { ...StandardDurations };
    }

    return toPayload(custom);
}

/** The five steppers of "Custom": the standard set when nothing is timed yet, 0 for "Off". */
export function customStart(
    durations: PhaseDurations | null,
): Required<PhaseDurations> {
    if (durations === null) {
        return { ...StandardDurations };
    }

    return {
        writing: durations.writing ?? 0,
        grouping: durations.grouping ?? 0,
        voting: durations.voting ?? 0,
        discussing: durations.discussing ?? 0,
        actions: durations.actions ?? 0,
    };
}

/** "Writing 7 · Voting 3 · Discussing 15": the help line of the row. */
export function summary(
    durations: PhaseDurations | null,
    label: (phase: TimedPhase) => string,
): string | null {
    const kept = durations === null ? null : toPayload(durations);

    if (kept === null) {
        return null;
    }

    return TimedPhases.filter((phase) => kept[phase] !== undefined)
        .map((phase) => `${label(phase)} ${kept[phase]}`)
        .join(' · ');
}

export type PhaseTimerOffer = {
    phase: TimedPhase;
    seconds: number;
    perTopic: boolean;
};

/** Spec §6.2: the current phase's duration, offered to the facilitator; null when the phase has none. */
export function offerFor(
    durations: PhaseDurations | null,
    phase: string,
): PhaseTimerOffer | null {
    const timed = TimedPhases.find((candidate) => candidate === phase);

    if (durations === null || timed === undefined) {
        return null;
    }

    const minutes = durations[timed];

    if (minutes === undefined || minutes < 1) {
        return null;
    }

    return {
        phase: timed,
        seconds: minutes * 60,
        perTopic: timed === 'discussing',
    };
}
