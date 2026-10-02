import { describe, expect, it } from 'vitest';
import { ownLayoutPages, usesOwnLayout } from '@/lib/page-layouts';

const pageFiles = Object.keys(import.meta.glob('../pages/**/*.tsx')).map(
    (path) => path.slice('../pages/'.length, -'.tsx'.length),
);

describe('page layouts', () => {
    it('lets the rewritten pages render their own layout', () => {
        for (const name of [
            'about',
            'admin/branding',
            'admin/admins',
            'dev/design-system',
            'retros/show',
            'retros/join',
            'retros/session-ended',
            'poker/show',
            'poker/decks',
            'games/index',
            'games/join',
            'poker/estimates',
            'poker/join',
            'games/show',
            'whiteboards/show',
            'whiteboards/join',
        ]) {
            expect(usesOwnLayout(name), name).toBe(true);
        }
    });

    it('leaves a page that is not listed to the old layouts', () => {
        expect(usesOwnLayout('not/a-page')).toBe(false);
    });

    it('lets every admin page render its own layout', () => {
        const adminPages = pageFiles.filter(
            (name) => name.startsWith('admin/') && !name.endsWith('.test'),
        );

        expect(adminPages.length).toBeGreaterThan(0);
        expect(usesOwnLayout('admin/a-future-page')).toBe(true);

        for (const name of adminPages) {
            expect(usesOwnLayout(name), name).toBe(true);
        }
    });

    it('lists only pages that exist', () => {
        for (const name of ownLayoutPages) {
            expect(pageFiles, name).toContain(name);
        }
    });
});
