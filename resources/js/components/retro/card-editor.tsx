import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, CardPayload } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { GifPicker, type PickedGif } from './gif-picker';

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
    const [gif, setGif] = useState<PickedGif | null>(card.gif);
    const [picking, setPicking] = useState(false);
    const canAttachGif =
        ctx.board.retro.gifProvider !== null &&
        ctx.board.retro.gifsEnabled &&
        ctx.isEditable;

    const latest = useRef({ content, savedContent: card.content, onDone });

    useEffect(() => {
        latest.current = { content, savedContent: card.content, onDone };
    });

    const closedIntentionally = useRef(false);
    const saveInFlight = useRef(false);
    const { hasActiveCard } = ctx;

    useEffect(
        () => () => {
            if (closedIntentionally.current) {
                return;
            }

            if (saveInFlight.current) {
                return;
            }

            if (!hasActiveCard(card.id)) {
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

        saveInFlight.current = true;
        setIsSaving(true);

        // Without a provider the card's gif is hidden but still stored, so
        // an unchanged gif is left out rather than sent as null.
        const gifChanged = (gif?.id ?? null) !== (card.gif?.id ?? null);

        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(
                CardsController.update({
                    retro: ctx.board.retro.id,
                    card: card.id,
                }),
                {
                    content: content.trim() === '' ? null : content.trim(),
                    ...(gifChanged && { gif_id: gif?.id ?? null }),
                },
            ),
        );

        saveInFlight.current = false;
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
                autoFocus
                aria-label={t('Edit card')}
                onChange={(event) => setContent(event.target.value)}
            />
            <div className="flex justify-end gap-2">
                {canAttachGif && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mr-auto"
                        onClick={() => setPicking(true)}
                    >
                        {t('GIF')}
                    </Button>
                )}
                <Button size="sm" variant="ghost" onClick={cancel}>
                    {t('Cancel')}
                </Button>
                <Button
                    size="sm"
                    disabled={
                        isSaving || (content.trim() === '' && gif === null)
                    }
                    onClick={() => void save()}
                >
                    {t('Save')}
                </Button>
            </div>
            {canAttachGif && (
                <GifPicker
                    open={picking}
                    onOpenChange={setPicking}
                    onPick={setGif}
                />
            )}
        </div>
    );
}
