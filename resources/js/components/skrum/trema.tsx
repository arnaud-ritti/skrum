import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** The two-dot loader: someone is writing, something is loading. */
export function Trema({
    size = 'sm',
    className,
    ...props
}: ComponentProps<'span'> & { size?: 'sm' | 'lg' }) {
    const dot = cn(
        'animate-trema rounded-full bg-current motion-reduce:animate-none',
        size === 'lg' ? 'size-1.5' : 'size-1',
    );

    return (
        <span
            aria-hidden="true"
            data-slot="trema"
            className={cn('inline-flex shrink-0 items-center gap-1', className)}
            {...props}
        >
            <span className={dot} />
            <span className={dot} style={{ animationDelay: '180ms' }} />
        </span>
    );
}
