import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsCard } from './settings-card';

describe('SettingsCard', () => {
    it('is a region named by its title, with the description under the title', () => {
        render(
            <SettingsCard
                title="Profile"
                description="How teammates see you in sessions and on cards."
            >
                <p>fields</p>
            </SettingsCard>,
        );

        const region = screen.getByRole('region', { name: 'Profile' });

        expect(
            within(region).getByRole('heading', { level: 2, name: 'Profile' }),
        ).toBeTruthy();
        expect(region.textContent).toContain(
            'How teammates see you in sessions and on cards.',
        );
        expect(
            region.querySelector('[data-slot="settings-card-body"]')
                ?.textContent,
        ).toBe('fields');
    });

    it('keeps the title and the description out of the card, above it', () => {
        render(
            <SettingsCard title="Profile" description="About you">
                <p>fields</p>
            </SettingsCard>,
        );

        const card = document.querySelector('[data-slot="card"]');

        expect(card?.textContent).toBe('fields');
    });

    it('draws the footer only when one is given', () => {
        const { rerender } = render(
            <SettingsCard title="Profile">
                <p>fields</p>
            </SettingsCard>,
        );

        expect(
            document.querySelector('[data-slot="settings-card-footer"]'),
        ).toBeNull();

        rerender(
            <SettingsCard
                title="Profile"
                footer={<button type="button">Save</button>}
            >
                <p>fields</p>
            </SettingsCard>,
        );

        expect(
            within(
                document.querySelector<HTMLElement>(
                    '[data-slot="settings-card-footer"]',
                )!,
            ).getByRole('button', { name: 'Save' }),
        ).toBeTruthy();
    });

    it('puts a destructive card on one row: warning icon, title, consequences, action', () => {
        render(
            <SettingsCard
                tone="destructive"
                title="Delete account"
                description="Permanently removes your profile and tokens."
            >
                <button type="button">Delete account</button>
            </SettingsCard>,
        );

        const region = screen.getByRole('region', { name: 'Delete account' });
        const card = region.querySelector('[data-slot="card"]');

        expect(region.getAttribute('data-tone')).toBe('destructive');
        expect(card?.textContent).toBe(
            'Delete accountPermanently removes your profile and tokens.Delete account',
        );
        expect(
            card
                ?.querySelector('[data-slot="settings-card-icon"] svg')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('draws a header row above the body, and a body without padding when it is flush', () => {
        render(
            <SettingsCard
                title="Two-factor authentication"
                header={<span>Authenticator</span>}
                flush
            >
                <p>rows</p>
            </SettingsCard>,
        );

        const card = screen
            .getByRole('region', { name: 'Two-factor authentication' })
            .querySelector('[data-slot="card"]')!;
        const header = card.querySelector('[data-slot="settings-card-header"]');
        const body = card.querySelector('[data-slot="settings-card-body"]');

        expect(header?.textContent).toBe('Authenticator');
        expect(header?.nextElementSibling).toBe(body);
        expect(body?.className).not.toContain('p-5');
    });

    it('puts the action of the card beside its title, out of the card', () => {
        render(
            <SettingsCard
                title="Active sessions"
                description="Devices signed in to your account."
                action={<button type="button">Sign out other sessions</button>}
            >
                <p>rows</p>
            </SettingsCard>,
        );

        const region = screen.getByRole('region', { name: 'Active sessions' });
        const action = within(region).getByRole('button', {
            name: 'Sign out other sessions',
        });

        expect(action.closest('[data-slot="card"]')).toBeNull();
        expect(
            action.closest('[data-slot="settings-card-heading"]')?.textContent,
        ).toContain('Active sessions');
    });
});
