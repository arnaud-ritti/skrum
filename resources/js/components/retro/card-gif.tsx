import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTrans } from '@/hooks/use-trans';
import type { CardGif as CardGifPayload } from '@/lib/retro/types';
import { dragIsolation } from './dnd';

export function CardGif({ gif }: { gif: CardGifPayload }) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className="mb-2 block w-full overflow-hidden rounded-md"
                aria-label={t('GIF')}
                {...dragIsolation}
                onClick={() => setOpen(true)}
            >
                <img
                    src={gif.previewUrl}
                    alt=""
                    loading="lazy"
                    className="h-auto w-full"
                />
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent {...dragIsolation} aria-describedby={undefined}>
                    <DialogTitle className="sr-only">{t('GIF')}</DialogTitle>
                    <img
                        src={gif.url}
                        alt=""
                        className="h-auto w-full rounded-md"
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}
