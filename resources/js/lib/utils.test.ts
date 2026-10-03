import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
    it('keeps the last of two conflicting Tailwind classes', () => {
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('keeps a text colour next to a custom text size of the theme', () => {
        expect(cn('text-primary', 'text-body-sm')).toBe(
            'text-primary text-body-sm',
        );
        expect(cn('text-xs', 'text-overline')).toBe('text-overline');
        expect(cn('text-muted-foreground', 'text-3xs')).toBe(
            'text-muted-foreground text-3xs',
        );
    });

    it('keeps a shadow colour next to a custom shadow of the theme', () => {
        expect(cn('shadow-primary', 'shadow-card')).toBe(
            'shadow-primary shadow-card',
        );
        expect(cn('shadow-sm', 'shadow-modal')).toBe('shadow-modal');
    });

    it('merges the custom widths, weights and trackings of the theme', () => {
        expect(cn('max-w-sm', 'max-w-page')).toBe('max-w-page');
        expect(cn('font-bold', 'font-title')).toBe('font-title');
        expect(cn('tracking-tight', 'tracking-heading')).toBe(
            'tracking-heading',
        );
    });

    it('merges the named maximum sizes of the theme', () => {
        expect(cn('max-h-dialog', 'max-h-96')).toBe('max-h-96');
        expect(cn('max-h-96', 'max-h-drawer')).toBe('max-h-drawer');
        expect(cn('max-w-viewport-gutter', 'max-w-sm')).toBe('max-w-sm');
    });
});
