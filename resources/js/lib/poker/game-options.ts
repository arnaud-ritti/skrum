import type { PokerTrackerSource } from './types';

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

type Option = { value: string; label: string };

/** The durations a round's task timer can start with (spec §6.3, X5). */
export const TaskTimerChoices = [60, 180, 300, 600] as const;

const TaskTimerOff = 'off';

/** "Don't write" in the write-back select. */
export const WriteBackOff = 'none';

/** "Write" for a source without fields: the connection's own field. */
export const WriteBackOn = 'write';

/** The tracker a game writes its estimates to, and the fields it offers. */
export type WriteBackTarget = {
    source: PokerTrackerSource;
    estimateFields: { id: string; name: string }[];
    defaultEstimateFieldId: string | null;
};

export function taskTimerOptions(t: Translate): Option[] {
    return [
        { value: TaskTimerOff, label: t('Off') },
        ...TaskTimerChoices.map((seconds) => ({
            value: String(seconds),
            label:
                seconds === 60
                    ? t('1 minute')
                    : t(':count minutes', { count: seconds / 60 }),
        })),
    ];
}

export function taskTimerChoice(seconds: number | null): string {
    return seconds === null ? TaskTimerOff : String(seconds);
}

export function taskTimerFromChoice(choice: string): number | null {
    const seconds = Number(choice);

    return (TaskTimerChoices as readonly number[]).includes(seconds)
        ? seconds
        : null;
}

export function writeBackOptions(
    target: WriteBackTarget,
    t: Translate,
): Option[] {
    const off = { value: WriteBackOff, label: t("Don't write") };

    if (target.estimateFields.length === 0) {
        return [off, { value: WriteBackOn, label: t('Write') }];
    }

    return [
        off,
        ...target.estimateFields.map((field) => ({
            value: field.id,
            label: field.name,
        })),
    ];
}

/** The select's value for a game: off, its field, or the connection's field when it has none. */
export function writeBackChoice(
    target: WriteBackTarget,
    writesEstimates: boolean,
    estimateFieldId: string | null,
): string {
    if (!writesEstimates) {
        return WriteBackOff;
    }

    const fieldIds = target.estimateFields.map((field) => field.id);

    if (fieldIds.length === 0) {
        return WriteBackOn;
    }

    if (estimateFieldId !== null && fieldIds.includes(estimateFieldId)) {
        return estimateFieldId;
    }

    if (
        target.defaultEstimateFieldId !== null &&
        fieldIds.includes(target.defaultEstimateFieldId)
    ) {
        return target.defaultEstimateFieldId;
    }

    return fieldIds[0];
}

export function writeBackPayload(choice: string): {
    writes_estimates: boolean;
    estimate_field_id: string | null;
} {
    if (choice === WriteBackOff) {
        return { writes_estimates: false, estimate_field_id: null };
    }

    if (choice === WriteBackOn) {
        return { writes_estimates: true, estimate_field_id: null };
    }

    return { writes_estimates: true, estimate_field_id: choice };
}

/** The first connected tracker that can take the estimates back; null without one. */
export function writableSource<
    T extends WriteBackTarget & { canWriteBack: boolean },
>(sources: T[]): T | null {
    return sources.find((source) => source.canWriteBack) ?? null;
}
