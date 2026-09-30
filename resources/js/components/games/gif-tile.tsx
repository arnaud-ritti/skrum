import type { ReactNode } from 'react';
import type { GameGif } from '@/lib/games/types';
import { cn } from '@/lib/utils';

type Props = {
    gif: GameGif;
    caption: string;
    highlight?: boolean;
    children?: ReactNode;
};

export function GifTile({ gif, caption, highlight = false, children }: Props) {
    return (
        <figure
            className={cn(
                'flex flex-col gap-2 rounded-lg border p-2',
                highlight && 'border-primary ring-1 ring-primary',
            )}
        >
            <img
                src={gif.previewUrl}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-md bg-muted object-cover"
            />
            <figcaption className="truncate text-center text-sm">
                {caption}
            </figcaption>
            {children}
        </figure>
    );
}
