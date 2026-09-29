import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, CardPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';

export function CardEditor({
    card,
    editable,
    onDone,
}: {
    card: BoardCard;
    editable: boolean;
    onDone: () => void;
}) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [content, setContent] = useState(card.content ?? '');
    const [isSaving, setIsSaving] = useState(false);

    const latest = useRef({ content, savedContent: card.content, onDone });

    useEffect(() => {
        latest.current = { content, savedContent: card.content, onDone };
    });

    const closedIntentionally = useRef(false);

    useEffect(
        () => () => {
            if (closedIntentionally.current) {
                return;
            }

            const { content, savedContent } = latest.current;

            if (content.trim() !== (savedContent ?? '').trim()) {
                toast(t('The phase changed before your edit was saved.'));
            }
        },
        [],
    );

    useEffect(() => {
        if (editable) {
            return;
        }

        closedIntentionally.current = true;

        const { content, savedContent, onDone } = latest.current;

        if (content.trim() !== (savedContent ?? '').trim()) {
            toast(t('The phase changed before your edit was saved.'));
        }

        onDone();
    }, [editable]);

    const cancel = () => {
        closedIntentionally.current = true;
        onDone();
    };

    const save = async () => {
        if (isSaving) {
            return;
        }

        setIsSaving(true);

        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(
                CardsController.update({
                    retro: ctx.board.retro.id,
                    card: card.id,
                }),
                { content: content.trim() },
            ),
        );

        setIsSaving(false);

        if (!response) {
            return;
        }

        ctx.apply({ type: 'cards.upsert', cards: [response.card] });
        closedIntentionally.current = true;
        onDone();
    };

    return (
        <div className="space-y-2">
            <Textarea
                value={content}
                maxLength={1000}
                autoFocus
                aria-label={t('Edit card')}
                onChange={(event) => setContent(event.target.value)}
            />
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancel}>
                    {t('Cancel')}
                </Button>
                <Button
                    size="sm"
                    disabled={isSaving || content.trim() === ''}
                    onClick={() => void save()}
                >
                    {t('Save')}
                </Button>
            </div>
        </div>
    );
}
