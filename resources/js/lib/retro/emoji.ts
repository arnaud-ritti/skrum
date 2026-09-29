export const QuickEmoji = ['👍', '❤️', '👏', '🎉', '🤔', '👎'] as const;

const MaxBytes = 64;
const SingleEmojiPattern =
    /^(?:\p{Regional_Indicator}{2}|[0-9#*]\u{FE0F}?\u{20E3}|\p{Extended_Pictographic}(?:\u{FE0F}|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])*(?:\u{200D}\p{Extended_Pictographic}(?:\u{FE0F}|[\u{1F3FB}-\u{1F3FF}])*)*)$/u;

/** Mirrors App\Rules\SingleEmoji, for messages that never reach the server. */
export function isSingleEmoji(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }

    if (new TextEncoder().encode(value).length > MaxBytes) {
        return false;
    }

    return SingleEmojiPattern.test(value);
}
