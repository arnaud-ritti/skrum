import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { activeToken, expiredToken, orphanToken } from './fixtures';
import { TokenCards } from './token-cards';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const formatDate = (value: string | null): string =>
    value === null ? 'Never' : value.slice(0, 10);

function cards(onRevoke = vi.fn()) {
    renderWithProviders(
        <TokenCards
            tokens={[activeToken, expiredToken, orphanToken]}
            formatDate={formatDate}
            newTokenName="Claude Code"
            onRevoke={onRevoke}
        />,
    );

    return onRevoke;
}

describe('TokenCards', () => {
    it('is a list of one card per token', () => {
        cards();

        const items = within(
            screen.getByRole('list', { name: 'API tokens' }),
        ).getAllByRole('listitem');

        expect(items).toHaveLength(3);
        expect(items[0].textContent).toContain('Claude Code');
        expect(items[0].textContent).toContain('New');
        expect(items[0].textContent).toContain('skrum_…a1b2');
        expect(items[0].textContent).toContain('Active');
        expect(items[1].textContent).toContain('Expired');
        expect(items[1].textContent).not.toContain('New');
    });

    it('names each value of a card', () => {
        cards();

        const card = within(screen.getAllByRole('listitem')[0]);

        expect(
            card.getByText('Team').nextElementSibling?.textContent,
        ).toContain('Atlas');
        expect(
            card.getByText('Created').nextElementSibling?.textContent,
        ).toContain('2026-09-01');
        expect(
            card.getByText('Expires').nextElementSibling?.textContent,
        ).toContain('2026-11-30');
        expect(
            card.getByText('Last used').nextElementSibling?.textContent,
        ).toContain('2026-09-28');
        expect(card.getByText('Create and update')).toBeTruthy();
    });

    it('warns about a team the member can no longer see', () => {
        cards();

        expect(screen.getAllByRole('listitem')[2].textContent).toContain(
            'No access to this team anymore',
        );
    });

    it('asks to revoke the token of the card', async () => {
        const onRevoke = cards();

        await userEvent.click(
            screen.getByRole('button', { name: 'Revoke Old script' }),
        );

        expect(onRevoke).toHaveBeenCalledWith(expiredToken);
    });
});
