import { Building2, Copy, Lock, Pencil, Star, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { isSpecialCard } from '@/lib/poker/types';
import { cn } from '@/lib/utils';

export type DeckCardModel = {
    id: string;
    name: string;
    cards: string[];
    /** `builtin` decks are locked; a `workspace` deck is shared by every team. */
    kind: 'builtin' | 'team' | 'workspace';
    isDefault: boolean;
    /** Games of the team that took this deck. */
    usageCount: number;
    createdBy?: string | null;
};

interface DeckCardProps {
    deck: DeckCardModel;
    /** An action is offered only when its handler is given. */
    onEdit?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onSetDefault?: () => void;
    /** A request about this deck is running: its actions wait. */
    busy?: boolean;
    className?: string;
}

export function DeckCard({
    deck,
    onEdit,
    onDuplicate,
    onDelete,
    onSetDefault,
    busy = false,
    className,
}: DeckCardProps) {
    const { t } = useTrans();
    const titleId = useId();
    const builtIn = deck.kind === 'builtin';
    const games =
        deck.usageCount === 1
            ? t('1 game')
            : t(':count games', { count: deck.usageCount });
    const facts = builtIn
        ? [t(':count values', { count: deck.cards.length }), games]
        : [
              t('Custom'),
              ...(deck.createdBy
                  ? [t('by :name', { name: deck.createdBy })]
                  : []),
              games,
          ];

    return (
        <Card
            asChild
            className={cn('h-full min-w-0 gap-3 p-4', className)}
            data-slot="deck-card"
            data-kind={deck.kind}
            data-default={deck.isDefault || undefined}
        >
            <article aria-labelledby={titleId}>
                <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                        <h2
                            id={titleId}
                            className="text-sm font-semibold wrap-anywhere"
                        >
                            {deck.name}
                        </h2>
                        <p
                            data-slot="deck-card-facts"
                            className="text-xs wrap-anywhere text-muted-foreground"
                        >
                            {facts.join(' · ')}
                        </p>
                    </div>
                    {deck.isDefault || deck.kind === 'workspace' ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            {deck.isDefault ? (
                                <Badge variant="soft">{t('Default')}</Badge>
                            ) : null}
                            {deck.kind === 'workspace' ? (
                                <Badge variant="muted" icon={Building2}>
                                    {t('Workspace')}
                                </Badge>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                <ul
                    aria-label={t('Values')}
                    data-slot="deck-card-values"
                    className="flex flex-wrap gap-1"
                >
                    {deck.cards.map((card) => (
                        <li
                            key={card}
                            data-special={isSpecialCard(card) || undefined}
                            className={cn(
                                'grid h-8.5 min-w-6.5 place-items-center rounded-sm border px-1 font-display text-body-sm font-bold whitespace-nowrap shadow-card',
                                isSpecialCard(card)
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-card text-foreground',
                            )}
                        >
                            {card}
                        </li>
                    ))}
                </ul>
                <div
                    data-slot="deck-card-actions"
                    className="mt-auto flex min-w-0 flex-wrap items-center gap-1 border-t pt-3"
                >
                    {builtIn ? (
                        <span className="mr-auto flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                            <Lock
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                            />
                            <span className="truncate">{t('Built-in')}</span>
                        </span>
                    ) : null}
                    {onEdit ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="max-w-full min-w-0"
                            disabled={busy}
                            aria-label={t('Edit :name', { name: deck.name })}
                            onClick={onEdit}
                        >
                            <Pencil aria-hidden="true" />
                            <span className="truncate">{t('Edit')}</span>
                        </Button>
                    ) : null}
                    {onDuplicate ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="max-w-full min-w-0"
                            disabled={busy}
                            aria-label={t('Duplicate :name', {
                                name: deck.name,
                            })}
                            onClick={onDuplicate}
                        >
                            <Copy aria-hidden="true" />
                            <span className="truncate">{t('Duplicate')}</span>
                        </Button>
                    ) : null}
                    {onDelete ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="max-w-full min-w-0 text-skrum-destructive-text hover:text-skrum-destructive-text"
                            disabled={busy}
                            aria-label={t('Delete :name', { name: deck.name })}
                            onClick={onDelete}
                        >
                            <Trash2 aria-hidden="true" />
                            <span className="truncate">{t('Delete')}</span>
                        </Button>
                    ) : null}
                    {onSetDefault && !deck.isDefault ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="max-w-full min-w-0"
                            disabled={busy}
                            aria-label={t('Set :name as default', {
                                name: deck.name,
                            })}
                            onClick={onSetDefault}
                        >
                            <Star aria-hidden="true" />
                            <span className="truncate">
                                {t('Set as default')}
                            </span>
                        </Button>
                    ) : null}
                </div>
            </article>
        </Card>
    );
}
