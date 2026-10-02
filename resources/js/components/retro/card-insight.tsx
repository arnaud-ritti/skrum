import { Frown, Meh, Smile } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { CardSentiment } from '@/lib/retro/types';

const SentimentIcons = {
    positive: Smile,
    neutral: Meh,
    negative: Frown,
} as const;

const SentimentLabels: Record<CardSentiment, string> = {
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
};

export function SentimentIcon({
    sentiment,
}: {
    sentiment: CardSentiment | null;
}) {
    const { t } = useTrans();

    if (sentiment === null) {
        return null;
    }

    const Icon = SentimentIcons[sentiment];

    return (
        <Icon
            role="img"
            aria-label={t(SentimentLabels[sentiment])}
            className="size-3.5 shrink-0 text-muted-foreground"
        />
    );
}
