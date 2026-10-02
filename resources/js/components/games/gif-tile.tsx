import { Crown } from 'lucide-react';
import type { ReactNode } from 'react';
import { PersonAvatar } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';
import type { GameGif } from '@/lib/games/types';
import { cn } from '@/lib/utils';

export type GifTileAuthor = {
    name: string;
    avatarUrl: string | null;
    isGuest: boolean;
};

type Props = {
    gif: Pick<GameGif, 'previewUrl'>;
    caption: string;
    /** Who sent the GIF: an avatar before the caption. */
    author?: GifTileAuthor | null;
    /** The viewer's own choice among the GIFs. */
    highlight?: boolean;
    /** The most voted GIF of a closed round. */
    winner?: boolean;
    children?: ReactNode;
    className?: string;
};

/** The card of one GIF: the image first, then who sent it and what the caller adds. */
export function GifTile({
    gif,
    caption,
    author = null,
    highlight = false,
    winner = false,
    children,
    className,
}: Props) {
    const { t } = useTrans();

    return (
        <figure
            data-slot="gif-tile"
            data-winner={winner || undefined}
            className={cn(
                'relative flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-left shadow-card',
                highlight && 'border-primary ring-1 ring-primary',
                winner && 'border-primary shadow-raised ring-2 ring-primary',
                className,
            )}
        >
            <img
                src={gif.previewUrl}
                alt=""
                loading="lazy"
                className="aspect-4/3 w-full bg-muted object-cover"
            />
            {winner && (
                <span
                    data-slot="gif-winner"
                    className="absolute top-2 left-2 inline-flex h-6 items-center gap-1 rounded-full bg-primary px-2 text-xs font-bold whitespace-nowrap text-primary-foreground"
                >
                    <Crown aria-hidden className="size-3.5" />
                    {t('Winner')}
                </span>
            )}
            <div className="flex min-w-0 flex-col gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                    {author && author.avatarUrl !== null && (
                        <PersonAvatar
                            name={author.name}
                            src={author.avatarUrl}
                            kind={author.isGuest ? 'guest' : 'member'}
                            size="xs"
                            decorative
                        />
                    )}
                    <figcaption className="min-w-0 flex-1 truncate text-body-sm font-semibold">
                        {caption}
                    </figcaption>
                </div>
                {children}
            </div>
        </figure>
    );
}
