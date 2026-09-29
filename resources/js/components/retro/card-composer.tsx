import { X } from 'lucide-react';
import { useState } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { CardPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { GifPicker, type PickedGif } from './gif-picker';

export function CardComposer({ columnId }: { columnId: string }) {
    const ctx = useBoard();
    const { t } = useTrans();
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);
    const [gif, setGif] = useState<PickedGif | null>(null);
    const [picking, setPicking] = useState(false);
    const canAttachGif =
        ctx.board.retro.gifProvider !== null &&
        ctx.board.retro.gifsEnabled &&
        ctx.isEditable;

    const submit = async () => {
        const trimmed = content.trim();

        if ((trimmed === '' && gif === null) || sending) {
            return;
        }

        setSending(true);
        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(
                CardsController.store(ctx.board.retro.id),
                {
                    column_id: columnId,
                    content: trimmed === '' ? null : trimmed,
                    gif_id: gif?.id ?? null,
                },
            ),
        );
        setSending(false);

        if (response) {
            ctx.apply({ type: 'cards.upsert', cards: [response.card] });
            setContent('');
            setGif(null);
        }
    };

    return (
        <>
            <form
                className="space-y-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                {gif && (
                    <div className="relative">
                        <img
                            src={gif.previewUrl}
                            alt=""
                            className="h-auto w-full rounded-md"
                        />
                        <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute top-1 right-1 size-6"
                            aria-label={t('Remove GIF')}
                            onClick={() => setGif(null)}
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                )}
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
                <div className="flex gap-2">
                    {canAttachGif && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPicking(true)}
                        >
                            {t('GIF')}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        className="flex-1"
                        disabled={
                            sending || (content.trim() === '' && gif === null)
                        }
                    >
                        {t('Add')}
                    </Button>
                </div>
            </form>
            {canAttachGif && (
                <GifPicker
                    open={picking}
                    onOpenChange={setPicking}
                    onPick={setGif}
                />
            )}
        </>
    );
}
