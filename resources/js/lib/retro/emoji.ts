export const QuickEmoji = ['👍', '❤️', '👏', '🎉', '🤔', '👎'] as const;

const MaxBytes = 64;
const EmojiStart =
    /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]️?⃣)/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Mirrors App\Rules\SingleEmoji, for messages that never reach the server. */
export function isSingleEmoji(value: unknown): value is string {
    if (typeof value !== 'string' || value === '') {
        return false;
    }

    if (new TextEncoder().encode(value).length > MaxBytes) {
        return false;
    }

    if ([...graphemes.segment(value)].length !== 1) {
        return false;
    }

    return EmojiStart.test(value);
}
