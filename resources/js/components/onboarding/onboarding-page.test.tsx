import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from '@/components/onboarding/onboarding-page';
import type { OnboardingProps } from '@/components/onboarding/onboarding-page';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    widths: { header: true, full: true },
    post: vi.fn(),
    put: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    Head: () => null,
    usePage: () => ({
        props: {
            translations: {},
            locale: 'en',
            locales: ['en', 'fr'],
            brand: null,
            auth: {
                user: { id: 'u1', name: 'Arnaud Ritti', avatarUrl: '' },
            },
        },
    }),
    router: { post: mocks.post, put: mocks.put, delete: vi.fn() },
}));

vi.mock('@/hooks/use-min-width', () => ({
    useMinWidth: (pixels: number) =>
        pixels >= 1280 ? mocks.widths.full : mocks.widths.header,
}));

beforeEach(() => {
    mocks.widths.header = true;
    mocks.widths.full = true;
    mocks.post.mockReset();
    mocks.put.mockReset();
});

const base: OnboardingProps = {
    step: 'workspace',
    workspace: null,
    team: null,
    teamAddressBase: 'https://skrum.test/t/',
    teamName: 'Atlas',
    defaultColor: 'lagoon',
    languages: [
        { value: 'en', label: 'English' },
        { value: 'fr', label: 'Français' },
    ],
    userLocale: 'en',
    inviteRoles: ['facilitator', 'member', 'observer'],
    invitedCount: 0,
    inviteLinkUrl: null,
    inviteLinkExpiresAt: new Date(
        Date.now() + 7 * 86_400_000 - 60_000,
    ).toISOString(),
    inviteLinkUsesCount: 0,
    hasHadInviteLink: false,
    membersCount: 0,
    canEditWorkspace: true,
};

const atTeam: OnboardingProps = {
    ...base,
    step: 'team',
    workspace: { name: 'Nordlys', slug: 'nordlys-abc123', locale: 'en' },
};

function stepStates(): Array<[string | null, string | null]> {
    return Array.from(
        screen.getByRole('banner').querySelectorAll('[data-slot="phase-step"]'),
    ).map((item) => [
        item.querySelector('.truncate')?.textContent ?? null,
        item.getAttribute('data-state'),
    ]);
}

function preview(): HTMLElement {
    return document.querySelector('[data-slot="team-preview"]') as HTMLElement;
}

describe('OnboardingPage', () => {
    it('opens on step 1 with its fields, the four steps in the header and the progress', () => {
        renderWithProviders(<OnboardingPage {...base} />);

        expect(
            screen.getByRole('heading', { name: 'Name your workspace' }),
        ).toBeTruthy();
        expect(stepStates()).toEqual([
            ['Workspace', 'current'],
            ['Team', 'upcoming'],
            ['Invite step', 'upcoming'],
            ['First ritual', 'upcoming'],
        ]);
        expect(
            screen
                .getAllByRole('progressbar')
                .find(
                    (bar) => bar.getAttribute('aria-label') === 'Step 1 of 4',
                ),
        ).toBeTruthy();
        expect(
            within(screen.getByRole('banner')).getByRole('button', {
                name: 'Log out',
            }),
        ).toBeTruthy();
    });

    it('marks the steps before the current one done', () => {
        renderWithProviders(
            <OnboardingPage
                {...atTeam}
                step="ritual"
                team={{
                    id: 't1',
                    name: 'Atlas',
                    slug: 'atlas',
                    color: 'plum',
                    description: null,
                }}
            />,
        );

        expect(stepStates().map(([, state]) => state)).toEqual([
            'done',
            'done',
            'done',
            'current',
        ]);
        expect(
            screen.getByRole('heading', {
                name: 'What do you want to start with?',
            }),
        ).toBeTruthy();
    });

    it('starts at step 2 with step 1 done and no "Back" after joining the default workspace', () => {
        renderWithProviders(
            <OnboardingPage {...atTeam} canEditWorkspace={false} />,
        );

        expect(stepStates().map(([, state]) => state)).toEqual([
            'done',
            'current',
            'upcoming',
            'upcoming',
        ]);
        expect(screen.getByText('Step 2 of 4')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
        expect(screen.queryByLabelText('Workspace name')).toBeNull();
    });

    it('prefills the team name from registration and the preview follows the name, colour and slug', () => {
        renderWithProviders(<OnboardingPage {...atTeam} />);

        expect(screen.getByLabelText('Team name')).toHaveProperty(
            'value',
            'Atlas',
        );
        expect(preview().textContent).toContain('skrum.test/t/atlas');
        expect(preview().textContent).toContain('Nordlys · 1 member');

        fireEvent.change(screen.getByLabelText('Team name'), {
            target: { value: 'Équipe Nord' },
        });
        fireEvent.click(screen.getByRole('radio', { name: 'Coral' }));

        expect(
            preview().querySelector('[data-slot="team-preview-name"]')
                ?.textContent,
        ).toBe('Équipe Nord');
        expect(
            preview().querySelector('[data-slot="team-preview-address"]')
                ?.textContent,
        ).toBe('skrum.test/t/equipe-nord');
        expect(
            preview().querySelector('[data-slot="team-mark"]')?.className,
        ).toContain('col-coral');

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Team link'), {
            target: { value: 'nord' },
        });

        expect(
            preview().querySelector('[data-slot="team-preview-address"]')
                ?.textContent,
        ).toBe('skrum.test/t/nord');
    });

    it('moves the stepper into the form and hides the preview on a phone', () => {
        mocks.widths.header = false;
        mocks.widths.full = false;
        const { container } = renderWithProviders(
            <OnboardingPage {...atTeam} />,
        );

        expect(
            screen
                .getByRole('banner')
                .querySelector('[data-slot="phase-stepper"]'),
        ).toBeNull();

        const stepper = screen
            .getByRole('main')
            .querySelector('[data-slot="phase-stepper"]');

        expect(stepper?.getAttribute('data-mode')).toBe('mobile');

        const aside = container.querySelector('aside');

        expect(aside?.className).toContain('hidden');
        expect(aside?.className).toContain('lg:flex');
        expect(
            document.querySelector('[data-slot="step-actions"]')?.className,
        ).toContain('max-md:sticky');
    });

    it('uses the compact rail in the header until the header holds every name', () => {
        mocks.widths.full = false;
        renderWithProviders(<OnboardingPage {...atTeam} />);

        expect(
            screen
                .getByRole('banner')
                .querySelector('[data-slot="phase-stepper"]')
                ?.getAttribute('data-mode'),
        ).toBe('mobile');
    });
});
