import { describe, expect, it } from 'vitest';
import { ownLayoutPages, usesOwnLayout } from '@/lib/page-layouts';

const pageFiles = Object.keys(import.meta.glob('../pages/**/*.tsx')).map(
    (path) => path.slice('../pages/'.length, -'.tsx'.length),
);

describe('page layouts', () => {
    it('lets the rewritten pages render their own layout', () => {
        for (const name of [
            'welcome',
            'about',
            'admin/branding',
            'admin/admins',
            'dev/design-system',
            'retros/show',
            'poker/show',
            'games/show',
            'whiteboards/show',
        ]) {
            expect(usesOwnLayout(name), name).toBe(true);
        }
    });

    it('leaves a page that is not listed to the old layouts', () => {
        expect(usesOwnLayout('not/a-page')).toBe(false);
    });

    it('lists only pages that exist', () => {
        for (const name of ownLayoutPages) {
            expect(pageFiles, name).toContain(name);
        }
    });
});
