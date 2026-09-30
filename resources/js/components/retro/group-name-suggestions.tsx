import { Sparkles } from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useState,
    type ReactNode,
} from 'react';
import { toast } from 'sonner';
import CardGroupNamesController from '@/actions/App/Http/Controllers/Retros/CardGroupNamesController';
import GroupNameSuggestionsController from '@/actions/App/Http/Controllers/Retros/GroupNameSuggestionsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard } from '@/lib/retro/types';
import { useBoard } from './board-context';

type GroupNameSuggestionsValue = {
    suggestions: Record<string, string>;
    busy: boolean;
    request: () => Promise<void>;
    dismiss: (cardId: string) => void;
};

const NamingPhases = ['grouping', 'voting', 'discussing'];

const GroupNameSuggestionsContext =
    createContext<GroupNameSuggestionsValue | null>(null);

/**
 * Suggestions are only kept in the requester's browser: nothing is saved
 * or broadcast until a name is accepted.
 */
export function GroupNameSuggestionsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [suggestions, setSuggestions] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const { run } = ctx;
    const retroId = ctx.board.retro.id;

    const request = useCallback(async () => {
        setBusy(true);
        const response = await run(
            retroRequest<{
                suggestions: Array<{ cardId: string; name: string }>;
            }>(GroupNameSuggestionsController.store(retroId)),
        );
        setBusy(false);

        if (!response) {
            return;
        }

        if (response.suggestions.length === 0) {
            toast(t('No new names to suggest.'));

            return;
        }

        setSuggestions((current) => ({
            ...current,
            ...Object.fromEntries(
                response.suggestions.map((suggestion) => [
                    suggestion.cardId,
                    suggestion.name,
                ]),
            ),
        }));
    }, [run, retroId, t]);

    const dismiss = useCallback((cardId: string) => {
        setSuggestions((current) => {
            const next = { ...current };

            delete next[cardId];

            return next;
        });
    }, []);

    return (
        <GroupNameSuggestionsContext
            value={{ suggestions, busy, request, dismiss }}
        >
            {children}
        </GroupNameSuggestionsContext>
    );
}

export function SuggestGroupNamesButton() {
    const ctx = useBoard();
    const { t } = useTrans();
    const value = useContext(GroupNameSuggestionsContext);
    const { features, retro, cards } = ctx.board;
    const hasUnnamedGroups = cards.some(
        (card) =>
            card.parentCardId === null &&
            card.groupName === null &&
            cards.some((child) => child.parentCardId === card.id),
    );

    if (
        !value ||
        !features.llm ||
        !retro.aiSummaryEnabled ||
        !NamingPhases.includes(retro.phase) ||
        !ctx.isEditable ||
        !hasUnnamedGroups
    ) {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                disabled={value.busy}
                onClick={() => void value.request()}
            >
                <Sparkles className="size-4" />
                {t('Suggest group names')}
            </Button>
            <span className="hidden max-w-56 text-xs text-muted-foreground xl:inline">
                {t('Card contents of these groups are sent to :provider.', {
                    provider: features.llmProvider ?? '',
                })}
            </span>
        </div>
    );
}

type SuggestionProps = {
    card: BoardCard;
    onEdit: (name: string) => void;
};

export function GroupNameSuggestion({ card, onEdit }: SuggestionProps) {
    const ctx = useBoard();
    const { t } = useTrans();
    const value = useContext(GroupNameSuggestionsContext);
    const [busy, setBusy] = useState(false);
    const name = value?.suggestions[card.id];

    if (!value || name === undefined || card.groupName !== null) {
        return null;
    }

    const accept = async () => {
        setBusy(true);
        const response = await ctx.run(
            retroRequest<{ cardId: string; groupName: string | null }>(
                CardGroupNamesController.update({
                    retro: ctx.board.retro.id,
                    card: card.id,
                }),
                { name },
            ),
        );
        setBusy(false);
        value.dismiss(card.id);

        if (response) {
            ctx.apply({
                type: 'card.groupName',
                cardId: response.cardId,
                groupName: response.groupName,
            });
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span
                title={t('Suggested name')}
                className="rounded border border-dashed px-1.5 py-0.5 text-muted-foreground italic"
            >
                {name}
            </span>
            <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                disabled={busy}
                onClick={() => void accept()}
            >
                {t('Use this name')}
            </Button>
            <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                disabled={busy}
                onClick={() => {
                    value.dismiss(card.id);
                    onEdit(name);
                }}
            >
                {t('Edit this name')}
            </Button>
        </div>
    );
}
