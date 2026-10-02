import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The custom scales of `@theme` in resources/css/app.css. Without them
 * tailwind-merge reads `text-body-sm` as a text colour and drops the colour
 * class that precedes it (and likewise for the other namespaces).
 */
const twMerge = extendTailwindMerge({
    extend: {
        theme: {
            text: [
                'display-xl',
                'display-lg',
                'poker',
                'stat',
                'ui-lg',
                'body-sm',
                'overline',
            ],
            'font-weight': ['title'],
            tracking: ['display', 'title', 'heading', 'subheading', 'overline'],
            shadow: ['card', 'raised', 'popover', 'modal', 'drag'],
            container: [
                'column',
                'page',
                'card-compact',
                'card-narrow',
                'card-wide',
                'action-stack',
            ],
            ease: ['standard', 'enter', 'exit', 'spring', 'flip'],
        },
        classGroups: {
            'max-h': [{ 'max-h': ['dialog', 'drawer'] }],
            'max-w': [{ 'max-w': ['viewport-gutter'] }],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
