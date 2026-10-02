import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { activeToken, expiredToken } from './fixtures';
import { TokenList } from './token-list';

const router = vi.hoisted(() => ({ delete: vi.fn() }));
const page = vi.hoisted(() => ({
    props: { translations: {}, locale: 'en' } as Record<string, unknown>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router,
}));

beforeEach(() => {
    router.delete.mockReset();
    page.props = { translations: {}, locale: 'en' };
});

describe('TokenList', () => {
    it('says there is no token yet, without a table', () => {
        renderWithProviders(<TokenList tokens={[]} />);

        expect(screen.getByText('No API tokens yet.')).toBeTruthy();
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('holds the table for a wide card and the cards for a narrow one', () => {
        renderWithProviders(<TokenList tokens={[activeToken, expiredToken]} />);

        const list = document.querySelector('[data-slot="token-list"]');

        expect(list?.classList.contains('@container/tokens')).toBe(true);
        expect(
            screen.getByRole('table').closest('[data-slot="token-list-table"]')
                ?.className,
        ).toBe('hidden @2xl/tokens:block');
        expect(
            screen
                .getByRole('list', { name: 'API tokens' })
                .closest('[data-slot="token-list-cards"]')?.className,
        ).toBe('@2xl/tokens:hidden');
    });

    it('writes the dates in the language of the member', () => {
        const expected = (locale: string): string =>
            new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                new Date(activeToken.createdAt as string),
            );

        page.props = { translations: {}, locale: 'fr' };

        renderWithProviders(<TokenList tokens={[activeToken]} />);

        expect(
            within(screen.getByRole('table')).getByText(expected('fr')),
        ).toBeTruthy();
        expect(expected('fr')).not.toBe(expected('en'));
    });

    it('opens the confirmation for the token of the row', async () => {
        renderWithProviders(<TokenList tokens={[activeToken, expiredToken]} />);

        await userEvent.click(
            within(screen.getByRole('table')).getByRole('button', {
                name: 'Revoke Old script',
            }),
        );

        expect(
            within(screen.getByRole('alertdialog')).getByText(
                'Clients using "Old script" lose access on their next request.',
            ),
        ).toBeTruthy();
        expect(router.delete).not.toHaveBeenCalled();
    });
});
