import { isSingleEmoji } from '@/lib/retro/emoji';

export const ClueSlots = 5;

const LetterLike =
    /\p{Regional_Indicator}|\u{20E3}|[\u{1F170}\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{2139}\u{24C2}\u{1F520}-\u{1F522}\u{1F524}]/u;

/** Mirrors App\Rules\ClueEmoji, to refuse letter-like picks before sending. */
export function isClueEmoji(value: string): boolean {
    return isSingleEmoji(value) && !LetterLike.test(value);
}
