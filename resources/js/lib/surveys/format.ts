/** The reader's language, as the page declares it: "3,8" and "56 %" in French, "3.8" and "56%" in English. */
function readerLocale(): string | undefined {
    return document.documentElement.lang || undefined;
}

/** A value with one decimal: a mean, a mean on 5, a move of a mean. */
export function formatDecimal(value: number): string {
    return value.toLocaleString(readerLocale(), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
}

/** A whole percentage, 0 to 100, written as the reader's language writes it. */
export function formatPercent(percent: number): string {
    return (percent / 100).toLocaleString(readerLocale(), {
        style: 'percent',
        maximumFractionDigits: 0,
    });
}
