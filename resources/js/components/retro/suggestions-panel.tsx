import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';
import { SuggestionsList } from './insights/suggestions-list';

export function SuggestionsPanel() {
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
            className="w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-4 lg:max-h-dvh lg:w-80 lg:self-start lg:overflow-y-auto"
        >
            <h2 className="text-sm font-semibold">{t('Suggestions')}</h2>
            <SuggestionsList />
        </aside>
    );
}
