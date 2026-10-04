import type { SurveyComparison } from './types';

/** "+1.5", "−0.6", or null when there is no difference to show. Uses the minus sign, not a hyphen. */
export function signed(value: number | null, digits = 0): string | null {
    if (value === null) {
        return null;
    }

    const amount = Math.abs(value).toFixed(digits);

    if (Number(amount) === 0) {
        return '0';
    }

    return value > 0 ? `+${amount}` : `−${amount}`;
}

/** The badges of the Summary cards: one per scale or NPS question that has a numeric difference. */
export function deltasByQuestion(
    comparison: SurveyComparison | null,
): Record<string, { value: number; against: string }> {
    if (comparison === null || comparison.belowThreshold) {
        return {};
    }

    return Object.fromEntries(
        comparison.pairs
            .filter(
                (pair): pair is typeof pair & { delta: number } =>
                    (pair.kind === 'scale' || pair.kind === 'nps') &&
                    typeof pair.delta === 'number',
            )
            .map((pair) => [
                pair.questionId,
                { value: pair.delta, against: comparison.other.title },
            ]),
    );
}
