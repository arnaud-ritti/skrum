import { Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import CardGroupNamesController from '@/actions/App/Http/Controllers/Retros/CardGroupNamesController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, RetroPhase } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { dragIsolation } from './dnd';
import { GroupNameSuggestion } from './group-name-suggestions';

const NamingPhases: RetroPhase[] = ['grouping', 'voting', 'discussing'];

type GroupNameResponse = { cardId: string; groupName: string | null };

export function GroupName({ card }: { card: BoardCard }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const settled = useRef(false);
    const canName =
        ctx.isEditable && NamingPhases.includes(ctx.board.retro.phase);

    if (!canName && card.groupName === null) {
        return null;
    }

    const save = async (name: string) => {
        if (busy || name === (card.groupName ?? '')) {
            return;
        }

        const groupName = name === '' ? null : name;
        const route = { retro: ctx.board.retro.id, card: card.id };

        setBusy(true);
        ctx.apply({ type: 'card.groupName', cardId: card.id, groupName });

        const response = await ctx.run(
            groupName === null
                ? retroRequest<GroupNameResponse>(
                      CardGroupNamesController.destroy(route),
                  )
                : retroRequest<GroupNameResponse>(
                      CardGroupNamesController.update(route),
                      { name: groupName },
                  ),
        );

        setBusy(false);

        if (response) {
            ctx.apply({
                type: 'card.groupName',
                cardId: response.cardId,
                groupName: response.groupName,
            });
        }
    };

    const startEditing = (initialDraft?: string) => {
        settled.current = false;
        setDraft(initialDraft ?? card.groupName ?? '');
        setEditing(true);
    };

    const finishEditing = (keeps: boolean) => {
        if (settled.current) {
            return;
        }

        settled.current = true;
        setEditing(false);

        if (keeps) {
            void save(draft.trim());
        }
    };

    if (editing) {
        return (
            <div {...dragIsolation}>
                <Input
                    autoFocus
                    value={draft}
                    maxLength={60}
                    aria-label={t('Group name')}
                    className="mb-2 h-8 font-semibold"
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => finishEditing(true)}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'Enter' &&
                            !event.nativeEvent.isComposing
                        ) {
                            event.preventDefault();
                            finishEditing(true);
                        }

                        if (event.key === 'Escape') {
                            finishEditing(false);
                        }
                    }}
                />
            </div>
        );
    }

    if (!canName) {
        return <p className="mb-2 font-semibold">{card.groupName}</p>;
    }

    return (
        <div {...dragIsolation}>
            <Button
                variant="ghost"
                size="sm"
                className="mb-2 h-auto w-full justify-start px-1 py-0.5 text-left font-semibold"
                aria-label={card.groupName ? t('Rename group') : undefined}
                disabled={busy}
                onClick={() => startEditing()}
            >
                {card.groupName ?? (
                    <span className="font-normal text-muted-foreground italic">
                        {t('Name this group')}
                    </span>
                )}
                <Pencil className="ml-auto size-3.5 text-muted-foreground" />
            </Button>
            <GroupNameSuggestion card={card} onEdit={startEditing} />
        </div>
    );
}
