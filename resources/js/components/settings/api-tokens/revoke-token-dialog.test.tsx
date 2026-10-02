import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { activeToken } from './fixtures';
import { RevokeTokenDialog } from './revoke-token-dialog';

type VisitOptions = {
    preserveScroll?: boolean;
    onSuccess?: () => void;
    onError?: () => void;
    onFinish?: () => void;
};

const router = vi.hoisted(() => ({ delete: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router,
}));

beforeEach(() => {
    router.delete.mockReset();
});

describe('RevokeTokenDialog', () => {
    it('asks before revoking, naming the token', () => {
        renderWithProviders(
            <RevokeTokenDialog
                token={activeToken}
                open
                onOpenChange={vi.fn()}
            />,
        );

        const dialog = within(screen.getByRole('alertdialog'));

        expect(dialog.getByText('Revoke this token?')).toBeTruthy();
        expect(
            dialog.getByText(
                'Clients using "Claude Code" lose access on their next request.',
            ),
        ).toBeTruthy();
        expect(router.delete).not.toHaveBeenCalled();
    });

    it('deletes the token and closes once the server has answered', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <RevokeTokenDialog
                token={activeToken}
                open
                onOpenChange={onOpenChange}
            />,
        );

        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        expect(router.delete).toHaveBeenCalledOnce();

        const [url, options] = router.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        expect(url).toContain(`/settings/api-tokens/${activeToken.id}`);
        expect(options.preserveScroll).toBe(true);
        expect(onOpenChange).not.toHaveBeenCalledWith(false);

        options.onSuccess?.();

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('stays open when the server refuses', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <RevokeTokenDialog
                token={activeToken}
                open
                onOpenChange={onOpenChange}
            />,
        );

        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Revoke',
            }),
        );

        (router.delete.mock.calls[0][1] as VisitOptions).onError?.();

        await waitFor(() =>
            expect(
                (
                    within(screen.getByRole('alertdialog')).getByRole(
                        'button',
                        {
                            name: 'Revoke',
                        },
                    ) as HTMLButtonElement
                ).disabled,
            ).toBe(false),
        );
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('gives the dialog back, with a message, when the visit ends without an answer', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <RevokeTokenDialog
                token={activeToken}
                open
                onOpenChange={onOpenChange}
            />,
        );

        const dialog = within(screen.getByRole('alertdialog'));

        await userEvent.click(dialog.getByRole('button', { name: 'Revoke' }));

        (router.delete.mock.calls[0][1] as VisitOptions).onFinish?.();

        await waitFor(() =>
            expect(dialog.getByRole('alert').textContent).toBe(
                'Something went wrong. Please try again.',
            ),
        );
        expect(
            (
                dialog.getByRole('button', {
                    name: 'Cancel',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('renders nothing to confirm without a token', () => {
        renderWithProviders(
            <RevokeTokenDialog
                token={null}
                open={false}
                onOpenChange={vi.fn()}
            />,
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});
