import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Its rows set the smallest height; past them the field grows with its text
 * instead of scrolling, up to a `max-h-*` of its caller.
 */
function fitToText(textarea: HTMLTextAreaElement | null): void {
    if (textarea === null) {
        return;
    }

    textarea.style.height = '';

    if (textarea.scrollHeight <= textarea.clientHeight) {
        return;
    }

    const borders = textarea.offsetHeight - textarea.clientHeight;

    textarea.style.height = `${textarea.scrollHeight + borders}px`;
}

function Textarea({
    className,
    ref,
    value,
    onInput,
    ...props
}: React.ComponentProps<'textarea'>) {
    const own = React.useRef<HTMLTextAreaElement | null>(null);

    const setRef = React.useCallback(
        (node: HTMLTextAreaElement | null) => {
            own.current = node;

            if (typeof ref === 'function') {
                return ref(node);
            }

            if (ref) {
                ref.current = node;
            }
        },
        [ref],
    );

    React.useLayoutEffect(() => fitToText(own.current), [value]);

    return (
        <textarea
            data-slot="textarea"
            ref={setRef}
            value={value}
            onInput={(event) => {
                fitToText(event.currentTarget);
                onInput?.(event);
            }}
            className={cn(
                'flex min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-[color,box-shadow,border-color] duration-140 ease-standard outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring',
                'aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive',
                'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-55',
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
