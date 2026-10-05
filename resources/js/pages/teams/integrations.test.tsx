import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type {
    IntegrationProviderCard,
    IntegrationProviderKey,
    WorkspaceSummary,
} from '@/types';
import TeamIntegrations from './integrations';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    Head: () => null,
}));

vi.mock('@/components/team-settings/team-settings-shell', () => ({
    TeamSettingsShell: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

beforeEach(() => {
    page.props = { translations: {}, locale: 'en' };
});

function card(
    provider: IntegrationProviderKey,
    label: string,
): IntegrationProviderCard {
    return {
        provider,
        label,
        usesOAuth: true,
        authMethods: ['oauth'],
        isTracker: false,
        connection: null,
    };
}

describe('team integrations page', () => {
    it('lists the providers as the rows of one card, each with its status line, switch and button', () => {
        renderWithProviders(
            <TeamIntegrations
                workspace={{ slug: 'nordlys' } as WorkspaceSummary}
                team={{ id: 't1', name: 'Atlas', description: null }}
                createdAt={null}
                membersCount={3}
                sections={{
                    general: true,
                    members: true,
                    integrations: true,
                    data: true,
                    firstUrl: '/w/nordlys/teams/t1/settings',
                }}
                providers={[
                    card('slack', 'Slack'),
                    card('jira', 'Jira'),
                    card('linear', 'Linear'),
                ]}
                telegram={null}
                mattermost={null}
                webhookEvents={null}
                pollMinutes={5}
            />,
        );

        const lists = document.querySelectorAll('[data-slot="card"]');

        expect(lists).toHaveLength(1);
        expect(lists[0].getAttribute('data-test')).toBe('integration-list');

        const rows = Array.from(lists[0].children) as HTMLElement[];

        expect(rows.map((row) => row.getAttribute('data-test'))).toEqual([
            'integration-card-slack',
            'integration-card-jira',
            'integration-card-linear',
        ]);

        for (const row of rows) {
            expect(
                row
                    .querySelector('[data-slot="provider-row-status"]')
                    ?.textContent?.split(' · ')[0],
            ).toBe('Not connected');
            expect(within(row).getByRole('switch')).not.toBeNull();
            expect(
                within(row).getByRole('button', { name: /^Connect / }),
            ).not.toBeNull();
        }

        expect(
            rows.map(
                (row) =>
                    within(row).getByRole('button', { name: /^Connect / })
                        .textContent,
            ),
        ).toEqual(['Connect', 'Connect', 'Connect']);
        expect(
            within(rows[1]).getByRole('button', { name: 'Connect Jira' }),
        ).not.toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
