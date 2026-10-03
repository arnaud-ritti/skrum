import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSettingsCard } from '@/components/teams/team-settings-card';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    on: vi.fn(() => () => {}),
    replace: vi.fn(),
    request: vi.fn(),
    toastError: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
        currentWorkspace: { role: 'admin' } as { role: string } | null,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
        router: {
            post: mocks.post,
            patch: mocks.patch,
            delete: mocks.delete,
            reload: mocks.reload,
            on: mocks.on,
            replace: mocks.replace,
        },
    };
});

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

function card() {
    return renderWithProviders(
        <TeamSettingsCard
            workspaceSlug="nordlys"
            team={{ id: 'team-1', name: 'Atlas' }}
        />,
    );
}

beforeEach(() => {
    mocks.patch.mockReset();
    mocks.delete.mockReset();
});

describe('the danger zone of the team settings', () => {
    it('is the danger zone: the consequence and the Delete team button', () => {
        card();

        const zone = screen.getByRole('region', { name: 'Delete team' });

        expect(zone.getAttribute('data-tone')).toBe('destructive');
        expect(zone.textContent).toContain(
            'This permanently deletes the team and its retrospectives.',
        );
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('deletes the team only after the confirmation', async () => {
        const user = userEvent.setup();
        mocks.delete.mockImplementation((_url: string, options: VisitOptions) =>
            options.onFinish?.(),
        );

        card();

        await user.click(screen.getByRole('button', { name: 'Delete team' }));

        const dialog = screen.getByRole('alertdialog');

        expect(within(dialog).getByText('Delete this team?')).toBeTruthy();
        expect(mocks.delete).not.toHaveBeenCalled();

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete team' }),
        );
        await act(async () => {});

        expect(mocks.delete.mock.calls[0][0]).toBe('/w/nordlys/teams/team-1');
    });
});
