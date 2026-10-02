import { Sparkles } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { useBoard } from './board-context';
import { SuggestionsList } from './suggestions-list';

/** The themes and the suggested actions of the retro, as a panel of the discussion. */
export function SuggestionsPanel({ className }: { className?: string }) {
    const { board } = useBoard();
    const { t } = useTrans();
    const insights = board.insights;

    if (
        insights === null ||
        (insights.themes.length === 0 && insights.suggestedActions.length === 0)
    ) {
        return null;
    }

    return (
        <aside
            aria-label={t('Suggestions')}
            data-slot="retro-suggestions-panel"
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-card',
                className,
            )}
        >
            <h2 className="flex min-w-0 items-center gap-2 text-base font-title">
                <Sparkles
                    className="size-4 shrink-0 text-skrum-primary-text"
                    aria-hidden
                />
                <span className="truncate">{t('Suggestions')}</span>
            </h2>
            <SuggestionsList />
        </aside>
    );
}
