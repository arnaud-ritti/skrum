import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import SuggestedActionPromotionsController from '@/actions/App/Http/Controllers/Retros/SuggestedActionPromotionsController';
import SuggestedActionsController from '@/actions/App/Http/Controllers/Retros/SuggestedActionsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem, SuggestedAction } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { SentimentIcon } from './card-insight';

type HandledResponse = {
    suggestedAction: SuggestedAction;
    actionItem?: ActionItem;
};

export function SuggestionsList() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busyId, setBusyId] = useState<string | null>(null);
    const { insights, viewer, retro, cards } = ctx.board;

    if (insights === null) {
        return null;
    }

    const canHandle =
        viewer.canHandleSuggestions &&
        (retro.phase === 'completed' || ctx.isEditable);
    const themeName = (themeId: string | null) =>
        insights.themes.find((theme) => theme.id === themeId)?.name ?? null;
    const pending = insights.suggestedActions.filter(
        (suggestion) => suggestion.status === 'pending',
    );
    const promoted = insights.suggestedActions.filter(
        (suggestion) => suggestion.status === 'promoted',
    );
    const rejected = insights.suggestedActions.filter(
        (suggestion) => suggestion.status === 'rejected',
    );

    const handle = async (suggestion: SuggestedAction, promote: boolean) => {
        if (busyId !== null) {
            return;
        }

        const route = { retro: retro.id, suggestedAction: suggestion.id };

        setBusyId(suggestion.id);
        const response = await ctx.run(
            retroRequest<HandledResponse>(
                promote
                    ? SuggestedActionPromotionsController.store(route)
                    : SuggestedActionsController.destroy(route),
            ),
        );
        setBusyId(null);

        if (!response) {
            return;
        }

        ctx.apply({
            type: 'insights.suggestion',
            suggestedAction: response.suggestedAction,
        });

        if (response.actionItem) {
            ctx.apply({
                type: 'actionItem.upsert',
                actionItem: response.actionItem,
            });
        }
    };

    return (
        <div className="space-y-4">
            {insights.themes.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                        {t('Themes')}
                    </h3>
                    <ul className="space-y-2">
                        {insights.themes.map((theme) => (
                            <li
                                key={theme.id}
                                className="rounded-md border p-2 text-sm"
                            >
                                <p className="font-medium">{theme.name}</p>
                                <ul className="mt-1 space-y-1">
                                    {theme.cardIds.map((cardId) => {
                                        const card = cards.find(
                                            (candidate) =>
                                                candidate.id === cardId,
                                        );

                                        if (!card || card.content === null) {
                                            return null;
                                        }

                                        return (
                                            <li
                                                key={cardId}
                                                className="flex items-start gap-1.5 text-xs text-muted-foreground"
                                            >
                                                <SentimentIcon
                                                    sentiment={card.sentiment}
                                                />
                                                <span className="min-w-0 flex-1 break-words">
                                                    {card.content}
                                                </span>
                                                {card.category && (
                                                    <Badge
                                                        variant="outline"
                                                        className="shrink-0 font-normal"
                                                    >
                                                        {card.category}
                                                    </Badge>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {(pending.length > 0 || promoted.length > 0) && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                        {t('Suggested actions')}
                    </h3>
                    <ul className="space-y-2">
                        {pending.map((suggestion) => (
                            <li
                                key={suggestion.id}
                                className="space-y-2 rounded-md border p-2 text-sm"
                            >
                                <p className="break-words">
                                    {suggestion.content}
                                </p>
                                {themeName(suggestion.themeId) && (
                                    <p className="text-xs text-muted-foreground">
                                        {t('Theme: :name', {
                                            name:
                                                themeName(suggestion.themeId) ??
                                                '',
                                        })}
                                    </p>
                                )}
                                {canHandle && (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            disabled={busyId !== null}
                                            onClick={() =>
                                                void handle(suggestion, true)
                                            }
                                        >
                                            {t('Promote')}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            disabled={busyId !== null}
                                            onClick={() =>
                                                void handle(suggestion, false)
                                            }
                                        >
                                            {t('Reject')}
                                        </Button>
                                    </div>
                                )}
                            </li>
                        ))}
                        {promoted.map((suggestion) => (
                            <li key={suggestion.id} className="text-sm">
                                {suggestion.actionItemId === null ? (
                                    <span
                                        title={t('Added to action items')}
                                        className="flex items-start gap-1.5"
                                    >
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 break-words">
                                            {suggestion.content}
                                        </span>
                                    </span>
                                ) : (
                                    <a
                                        href={`#action-item-${suggestion.actionItemId}`}
                                        title={t('Added to action items')}
                                        className="flex items-start gap-1.5 hover:underline"
                                    >
                                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 break-words">
                                            {suggestion.content}
                                        </span>
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {rejected.length > 0 && (
                <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                        {t('Dismissed (:count)', { count: rejected.length })}
                    </summary>
                    <ul className="mt-2 space-y-1">
                        {rejected.map((suggestion) => (
                            <li
                                key={suggestion.id}
                                className="break-words text-muted-foreground line-through"
                            >
                                {suggestion.content}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
