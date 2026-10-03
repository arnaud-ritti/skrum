import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { DeactivateDialog } from './deactivate-dialog';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router,
}));

const user: AdminUser = {
    id: '0199a0b4-6d8e-7c41-9f2a-1b2c3d4e5f60',
    name: 'Théo Martin',
    email: 'theo@atlas.fr',
    avatarUrl: '',
    isAdmin: false,
    isDeactivated: false,
    hasSecondFactor: false,
    workspacesCount: 1,
    createdAt: null,
    lastSignedInAt: null,
    isSelf: false,
};

async function confirm(): Promise<VisitOptions> {
    await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', {
            name: 'Deactivate',
        }),
    );

    const [url, data, options] = router.post.mock.calls[0] as [
        string,
        unknown,
        VisitOptions,
    ];

    expect(url).toBe(`/admin/users/${user.id}/deactivation`);
    expect(data).toEqual({});

    return options;
}

beforeEach(() => {
    router.post.mockReset();
});

describe('DeactivateDialog', () => {
    it('says what deactivating does before posting', () => {
        renderWithProviders(
            <DeactivateDialog user={user} open onOpenChange={vi.fn()} />,
        );

        const dialog = within(screen.getByRole('alertdialog'));

        expect(dialog.getByText('Deactivate Théo Martin?')).toBeTruthy();
        expect(
            dialog.getByText(
                "They are signed out and can't sign in until you reactivate them. Their content stays.",
            ),
        ).toBeTruthy();
        expect(router.post).not.toHaveBeenCalled();
    });

    it('posts the deactivation and closes once the server has answered', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <DeactivateDialog user={user} open onOpenChange={onOpenChange} />,
        );

        const options = await confirm();

        options.onSuccess?.();
        options.onFinish?.();

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('stays open with the reason the server refused', async () => {
        renderWithProviders(
            <DeactivateDialog user={user} open onOpenChange={vi.fn()} />,
        );

        const options = await confirm();

        options.onError?.({
            user: 'You cannot deactivate your own account or the last active admin.',
        });

        expect(
            await screen.findByText(
                'You cannot deactivate your own account or the last active admin.',
            ),
        ).toBeTruthy();
    });

    it('stays open with a message when the visit ends without an answer', async () => {
        renderWithProviders(
            <DeactivateDialog user={user} open onOpenChange={vi.fn()} />,
        );

        const options = await confirm();

        options.onFinish?.();

        expect(
            await screen.findByText('Something went wrong. Please try again.'),
        ).toBeTruthy();
    });
});
