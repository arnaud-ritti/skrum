import { useState } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { CardPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';

export function CardComposer({ columnId }: { columnId: string }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);
        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(
                CardsController.store(ctx.board.retro.id),
                { column_id: columnId, content: trimmed },
            ),
        );
        setSending(false);

        if (response) {
            ctx.dispatch({ type: 'cards.upsert', cards: [response.card] });
            setContent('');
        }
    };

    return (
        <form
            className="space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            <Textarea
                value={content}
                maxLength={1000}
                placeholder={t('Add a card…')}
                aria-label={t('Add a card…')}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <Button
                size="sm"
                className="w-full"
                disabled={sending || content.trim() === ''}
            >
                {t('Add')}
            </Button>
        </form>
    );
}
