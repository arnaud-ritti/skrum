import { screen } from '@testing-library/react';
import { LinkIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AccessNotice } from '@/components/auth/access-notice';
import { renderWithProviders } from '@/test/render';

describe('AccessNotice', () => {
    it('shows the title, the text, the hint and the action', () => {
        renderWithProviders(
            <AccessNotice
                icon={LinkIcon}
                title="Join a retrospective"
                description="This guest link is no longer valid."
                hint="Guests: ask the facilitator for the guest link."
                action={<a href="/login">Log in</a>}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Join a retrospective' }),
        ).toBeTruthy();
        expect(
            screen.getByText('This guest link is no longer valid.'),
        ).toBeTruthy();
        expect(
            screen.getByText('Guests: ask the facilitator for the guest link.'),
        ).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    });

    it('marks the destructive tone on its icon', () => {
        renderWithProviders(
            <AccessNotice
                icon={LinkIcon}
                tone="destructive"
                title="Access denied"
                description="You cannot open this page."
            />,
        );

        expect(
            document
                .querySelector('[data-slot="access-notice-mark"]')
                ?.classList.contains('bg-skrum-destructive-soft'),
        ).toBe(true);
    });

    it('marks the warning tone on its icon', () => {
        renderWithProviders(
            <AccessNotice
                icon={LinkIcon}
                tone="warning"
                title="This invitation has expired"
                description="It was valid until 24 September."
            />,
        );

        expect(
            document
                .querySelector('[data-slot="access-notice-mark"]')
                ?.classList.contains('bg-skrum-warning-soft'),
        ).toBe(true);
    });
});
