import type { RetroPhase } from './types';

/** English keys of the phase names; translated where they are shown. */
export const PhaseLabels: Record<RetroPhase, string> = {
    health_check: 'Health check',
    icebreaker: 'Icebreaker',
    writing: 'Writing',
    grouping: 'Grouping',
    voting: 'Voting',
    discussing: 'Discussing',
    completed: 'Completed',
};

const CompletedPhase: RetroPhase = 'completed';

/** The phases a retro walks through; the completed state is not a step of the rail. */
export function stepperPhases(phases: readonly RetroPhase[]): RetroPhase[] {
    return phases.filter((phase) => phase !== CompletedPhase);
}

/** Where "Next" (or "Complete", from the last phase) leads; null once completed. */
export function nextPhase(
    phases: readonly RetroPhase[],
    current: RetroPhase,
): RetroPhase | null {
    const index = phases.indexOf(current);

    if (index === -1) {
        return null;
    }

    return phases[index + 1] ?? null;
}

/** Where "Reopen" leads: the last phase before the completed state. */
export function reopenPhase(phases: readonly RetroPhase[]): RetroPhase | null {
    return stepperPhases(phases).at(-1) ?? null;
}
