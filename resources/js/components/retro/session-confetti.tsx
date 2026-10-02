import { useState } from 'react';
import type { CSSProperties } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import type { ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export const ConfettiPieces = 40;

/** Without column colours, the four of the default template. */
const FallbackColors: ColumnColor[] = ['moss', 'coral', 'sun', 'plum'];

type Piece = {
    /** A sticky note with its folded corner, or the two dots of the "ü". */
    shape: 'note' | 'trema';
    color: ColumnColor;
    dx: number;
    dy: number;
    rotation: number;
    delay: number;
};

export function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

function between(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function burst(colors: ColumnColor[]): Piece[] {
    const palette = colors.length > 0 ? colors : FallbackColors;

    return Array.from({ length: ConfettiPieces }, (_, index) => ({
        shape: index % 3 === 2 ? 'trema' : 'note',
        color: palette[index % palette.length],
        dx: between(-34, 34),
        dy: between(-1, 9),
        rotation: between(-320, 320),
        delay: between(0, 160),
    }));
}

/**
 * One burst from the top of the session-end screen, in the colours of the
 * columns. It plays once and fades; it is never mounted for a viewer who
 * prefers reduced motion.
 */
export function SessionConfetti({ colors }: { colors: ColumnColor[] }) {
    const [pieces] = useState<Piece[]>(() =>
        prefersReducedMotion() ? [] : burst(colors),
    );

    if (pieces.length === 0) {
        return null;
    }

    return (
        <div
            aria-hidden
            data-slot="session-confetti"
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48 overflow-hidden motion-reduce:hidden"
        >
            {pieces.map((piece, index) => (
                <span
                    key={index}
                    data-shape={piece.shape}
                    className={cn(
                        'absolute top-6 left-1/2 animate-confetti',
                        columnColorClass(piece.color),
                        piece.shape === 'note'
                            ? 'h-2.5 w-3 rounded-xs rounded-bl-sm bg-(--col-border)'
                            : 'flex gap-0.5',
                    )}
                    style={
                        {
                            '--dx': `${piece.dx.toFixed(2)}rem`,
                            '--dy': `${piece.dy.toFixed(2)}rem`,
                            '--rot': `${piece.rotation.toFixed(0)}deg`,
                            animationDelay: `${piece.delay.toFixed(0)}ms`,
                        } as CSSProperties
                    }
                >
                    {piece.shape === 'trema' && (
                        <>
                            <i className="size-1.5 rounded-full bg-(--col-border)" />
                            <i className="size-1.5 rounded-full bg-(--col-border)" />
                        </>
                    )}
                </span>
            ))}
        </div>
    );
}
