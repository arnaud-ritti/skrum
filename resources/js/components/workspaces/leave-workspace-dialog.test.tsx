import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    LeaveWorkspaceDialog,
    LeaveWorkspacePanel,
    matchesWorkspaceName,
} from '@/components/workspaces/leave-workspace-dialog';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onSuccess: () => void;
    onError: (errors: Record<string, string>) => void;
    onFinish: () => void;
};

const mocks = vi.hoisted(() => ({
    delete: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        auth: { user: { id: 'user-1' } },
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: mocks.props }),
    router: { delete: mocks.delete },
}));

const workspace = { id: 'w1', name: 'Nordlys', slug: 'nordlys' };

function lastVisit(): VisitOptions {
    return mocks.delete.mock.calls.at(-1)?.[1] as VisitOptions;
}

function consequences(scope: HTMLElement): string[] {
    return Array.from(
        scope.querySelectorAll('[data-slot="leave-consequences"] li'),
    ).map((line) => line.textContent ?? '');
}

beforeEach(() => {
    mocks.delete.mockReset();
});

describe('matchesWorkspaceName', () => {
    it('wants the exact name, spaces around it aside', () => {
        expect(matchesWorkspaceName('Nordlys', 'Nordlys')).toBe(true);
        expect(matchesWorkspaceName('  Nordlys ', 'Nordlys')).toBe(true);
        expect(matchesWorkspaceName('nordlys', 'Nordlys')).toBe(false);
        expect(matchesWorkspaceName('Nordly', 'Nordlys')).toBe(false);
        expect(matchesWorkspaceName('', 'Nordlys')).toBe(false);
    });
});

describe('LeaveWorkspacePanel', () => {
    function panel(
        props: Partial<Parameters<typeof LeaveWorkspacePanel>[0]> = {},
    ) {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <LeaveWorkspacePanel
                open
                onOpenChange={onOpenChange}
                workspace={workspace}
                {...props}
            />,
        );

        return { onOpenChange, dialog: screen.getByRole('alertdialog') };
    }

    it('renders nothing while closed', () => {
        renderWithProviders(
            <LeaveWorkspacePanel
                open={false}
                onOpenChange={() => {}}
                workspace={workspace}
            />,
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('is an alert dialog named by its question, with the focus in the field', () => {
        const { dialog } = panel();

        expect(dialog.getAttribute('aria-modal')).toBe('false');
        expect(
            within(dialog).getByRole('heading', { name: 'Leave Nordlys?' }),
        ).toBeTruthy();
        expect(document.activeElement).toBe(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
        );
    });

    it('lists the teams left, the other admin and the way back', () => {
        const { dialog } = panel({
            teams: ['Atlas', 'Borealis', 'Comet'],
            adminsCount: 2,
            otherAdminName: 'Camille R',
        });

        expect(consequences(dialog)).toEqual([
            'You leave Atlas, Borealis, and Comet.',
            "You're one of 2 admins — Camille R stays admin.",
            'An admin can invite you again later.',
        ]);
    });

    it('counts the teams when they are more than three', () => {
        const { dialog } = panel({ teams: ['A', 'B', 'C', 'D'] });

        expect(consequences(dialog)[0]).toBe('You leave 4 teams.');
    });

    it('tells the only admin so, and says nothing of admins to a member', () => {
        const { dialog } = panel({ adminsCount: 1 });

        expect(consequences(dialog)).toEqual([
            "You're the only admin of this workspace.",
            'An admin can invite you again later.',
        ]);
    });

    it('says only the way back when it knows nothing else', () => {
        const { dialog } = panel();

        expect(consequences(dialog)).toEqual([
            'An admin can invite you again later.',
        ]);
    });

    it('keeps the destructive button disabled until the name is typed', async () => {
        const { dialog } = panel();
        const submit = within(dialog).getByRole('button', {
            name: 'Leave Nordlys',
        }) as HTMLButtonElement;

        expect(submit.disabled).toBe(true);

        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            'Nordly',
        );
        expect(submit.disabled).toBe(true);

        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            's',
        );
        expect(submit.disabled).toBe(false);
        expect(mocks.delete).not.toHaveBeenCalled();
    });

    it('removes the user from the workspace once the name is typed', async () => {
        const { dialog } = panel();

        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            'Nordlys',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: /Leave Nordlys/ }),
        );

        expect(mocks.delete).toHaveBeenCalledTimes(1);
        expect(mocks.delete.mock.calls[0][0]).toBe('/w/nordlys/members/user-1');
        expect(dialog.getAttribute('aria-busy')).toBe('true');
    });

    it('shows the refusal of the server to the last owner and stays open', async () => {
        const { dialog, onOpenChange } = panel();

        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            'Nordlys',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: /Leave Nordlys/ }),
        );
        await act(async () => {
            lastVisit().onError({
                member: 'A workspace needs at least one owner.',
            });
            lastVisit().onFinish();
        });

        await waitFor(() =>
            expect(within(dialog).getByRole('alert').textContent).toBe(
                'A workspace needs at least one owner.',
            ),
        );
        expect(dialog.getAttribute('aria-busy')).toBe('false');
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('closes on Cancel and on Escape', async () => {
        const { dialog, onOpenChange } = panel();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );
        expect(onOpenChange).toHaveBeenLastCalledWith(false);

        onOpenChange.mockClear();
        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            '{Escape}',
        );
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });
});

describe('LeaveWorkspaceDialog', () => {
    it('asks the same question in a modal dialog, with a door on its button', async () => {
        renderWithProviders(
            <LeaveWorkspaceDialog
                open
                onOpenChange={() => {}}
                workspace={workspace}
                teams={['Atlas']}
            />,
        );

        const dialog = screen.getByRole('dialog', { name: 'Leave Nordlys?' });
        const submit = within(dialog).getByRole('button', {
            name: 'Leave Nordlys',
        }) as HTMLButtonElement;

        expect(consequences(dialog)).toEqual([
            'You leave Atlas.',
            'An admin can invite you again later.',
        ]);
        expect(submit.disabled).toBe(true);
        expect(submit.querySelector('svg.lucide-door-open')).not.toBeNull();

        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            'Nordlys',
        );
        expect(submit.disabled).toBe(false);

        await userEvent.click(submit);
        expect(mocks.delete.mock.calls[0][0]).toBe('/w/nordlys/members/user-1');
    });

    it('shows the refusal of the server and stays open', async () => {
        const onOpenChange = vi.fn();

        renderWithProviders(
            <LeaveWorkspaceDialog
                open
                onOpenChange={onOpenChange}
                workspace={workspace}
            />,
        );

        const dialog = screen.getByRole('dialog');

        await userEvent.type(
            within(dialog).getByLabelText('Type Nordlys to confirm'),
            'Nordlys',
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: /Leave Nordlys/ }),
        );
        await act(async () => {
            lastVisit().onError({
                member: 'A workspace needs at least one owner.',
            });
        });

        await waitFor(() =>
            expect(within(dialog).getByRole('alert').textContent).toBe(
                'A workspace needs at least one owner.',
            ),
        );
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
});
