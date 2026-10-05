import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { LicenceCard } from './licence-card';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

describe('LicenceCard', () => {
    it('names the licence, counts the accounts and links to the text and the source', () => {
        renderWithProviders(
            <LicenceCard
                licence="AGPL-3.0-or-later"
                licenceUrl="https://github.com/skrum/skrum/blob/main/LICENSE"
                repositoryUrl="https://github.com/skrum/skrum"
                accountsInUse={38}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Licence' })).toBeTruthy();
        expect(screen.getByText('AGPL-3.0-or-later')).toBeTruthy();
        expect(
            screen.getByText(
                'Open source under the GNU Affero General Public License v3.0 or later; every feature is included.',
            ),
        ).toBeTruthy();
        expect(
            document.querySelector('[data-slot="licence-accounts"]')
                ?.textContent,
        ).toBe('38');
        expect(screen.getByText('No limit, no expiry.')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: /Licence text/ })
                .getAttribute('href'),
        ).toBe('https://github.com/skrum/skrum/blob/main/LICENSE');
        expect(
            screen
                .getByRole('link', { name: /Source code/ })
                .getAttribute('href'),
        ).toBe('https://github.com/skrum/skrum');
    });
});
