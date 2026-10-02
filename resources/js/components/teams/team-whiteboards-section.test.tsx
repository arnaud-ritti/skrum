import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamWhiteboardsSection } from '@/components/teams/team-whiteboards-section';
import { RetroRequestError } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';
import type { WhiteboardSummary } from '@/types';

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

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: mocks.request,
}));

vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

const mine: WhiteboardSummary = {
    id: 'board-1',
    title: 'Sprint board',
    updatedAt: '2026-09-24T10:00:00+00:00',
    facilitatorName: 'Fran Facilitator',
    canDelete: true,
};

const theirs: WhiteboardSummary = {
    ...mine,
    id: 'board-2',
    title: 'Realtime architecture',
    facilitatorName: 'Mia Member',
    canDelete: false,
};

function section(boards: WhiteboardSummary[] = [mine, theirs]) {
    return renderWithProviders(
        <TeamWhiteboardsSection
            workspaceSlug="nordlys"
            boards={boards}
            templates={[
                {
                    id: 'tpl',
                    name: 'Kick-off',
                    description: null,
                    canManage: true,
                },
            ]}
        />,
    );
}

beforeEach(() => {
    mocks.request.mockReset();
    mocks.reload.mockReset();
    mocks.toastError.mockReset();
});

describe('the whiteboards of a team', () => {
    it('shows an empty state without a board', () => {
        section([]);

        expect(screen.getByText('No whiteboards yet.')).toBeTruthy();
    });

    it('links a board with its facilitator inside the link and its delete button outside', () => {
        section();

        const link = screen.getByRole('link', { name: /Sprint board/ });
        const remove = screen.getByRole('button', {
            name: 'Delete Sprint board',
        });

        expect(link.getAttribute('href')).toBe('/whiteboards/board-1');
        expect(link.textContent).toContain('Facilitated by Fran Facilitator');
        expect(link.contains(remove)).toBe(false);
        expect(
            screen.queryByRole('button', {
                name: 'Delete Realtime architecture',
            }),
        ).toBeNull();
    });

    it('deletes a board after a confirmation and reloads only the boards', async () => {
        const user = userEvent.setup();
        mocks.request.mockResolvedValue(null);

        section();

        await user.click(
            screen.getByRole('button', { name: 'Delete Sprint board' }),
        );

        const dialog = screen.getByRole('dialog');

        expect(within(dialog).getByText('Delete this board?')).toBeTruthy();
        expect(mocks.request).not.toHaveBeenCalled();

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete this board' }),
        );

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(mocks.request.mock.calls[0][0].url).toBe('/whiteboards/board-1');
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['whiteboards'] });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the date whole, on a second line when the facilitator leaves it no room', () => {
        section();

        const link = screen.getByRole('link', { name: /Sprint board/ });
        const date = link.querySelector('[data-slot="whiteboard-date"]');

        expect(link.textContent).toContain(
            'Facilitated by Fran Facilitator · Sep 24, 2026',
        );
        expect(date?.textContent).toBe('Sep 24, 2026');
        expect(date?.className).toContain('whitespace-nowrap');
        expect(date?.parentElement?.className).toContain('flex-wrap');
    });

    it('moves the focus to the heading of the section once a board is deleted', async () => {
        const user = userEvent.setup();
        mocks.request.mockResolvedValue(null);

        section();

        await user.click(
            screen.getByRole('button', { name: 'Delete Sprint board' }),
        );
        await user.click(
            screen.getByRole('button', { name: 'Delete this board' }),
        );
        await act(async () => {});

        expect(document.activeElement).toBe(
            screen.getByRole('heading', { level: 2, name: /Whiteboards/ }),
        );
    });

    it('closes the dialog and reloads the boards when the board was already deleted', async () => {
        const user = userEvent.setup();
        mocks.request.mockRejectedValue(
            new RetroRequestError(404, 'This board no longer exists.'),
        );

        section();

        await user.click(
            screen.getByRole('button', { name: 'Delete Sprint board' }),
        );
        await user.click(
            screen.getByRole('button', { name: 'Delete this board' }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This board no longer exists.',
        );
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['whiteboards'] });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps the dialog and says why when the server refuses', async () => {
        const user = userEvent.setup();
        mocks.request.mockRejectedValue(
            new RetroRequestError(403, 'This board cannot be deleted.'),
        );

        section();

        await user.click(
            screen.getByRole('button', { name: 'Delete Sprint board' }),
        );
        await user.click(
            screen.getByRole('button', { name: 'Delete this board' }),
        );

        expect(mocks.toastError).toHaveBeenCalledWith(
            'This board cannot be deleted.',
        );
        expect(mocks.reload).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('opens the templates manager from the "…" menu and gives focus back to it', async () => {
        const user = userEvent.setup();

        section();

        expect(screen.queryByText('Whiteboard templates')).toBeNull();

        const menu = screen.getByRole('button', {
            name: 'Whiteboards actions',
        });

        await user.click(menu);
        await user.click(
            screen.getByRole('menuitem', { name: 'Whiteboard templates' }),
        );

        const dialog = screen.getByRole('dialog', {
            name: 'Whiteboard templates',
        });

        expect(within(dialog).getByText('Kick-off')).toBeTruthy();

        await user.keyboard('{Escape}');
        await act(async () => {});

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(menu);
    });
});
