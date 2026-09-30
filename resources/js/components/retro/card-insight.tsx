import { Frown, Meh, Smile } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import type { BoardCard, CardSentiment } from '@/lib/retro/types';

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

export function CardInsight({ card }: { card: BoardCard }) {
    if (card.hidden || (card.sentiment === null && card.category === null)) {
        return null;
    }

    return (
        <div className="mb-1.5 flex items-center gap-1.5">
            <SentimentIcon sentiment={card.sentiment} />
            {card.category && (
                <Badge
                    variant="outline"
                    className="px-1.5 py-0 text-[11px] font-normal"
                >
                    {card.category}
                </Badge>
            )}
        </div>
    );
}
