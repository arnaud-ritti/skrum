import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemComments } from '@/components/action-items/item-comments';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import { RetroRequestError } from '@/lib/retro/api';
import type { ActionItemComment } from '@/lib/retro/types';
import {
    actionItemEndpointsFixture,
    actionItemFixture,
    actionItemMutationsFixture,
    actionItemViewerFixture,
} from '@/test/action-items';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const endpoints = actionItemEndpointsFixture();

function comment(
    overrides: Partial<ActionItemComment> = {},
): ActionItemComment {
    return {
        id: 'comment-1',
        actionItemId: 'item-1',
        content: 'Started on Monday.',
        author: { name: 'Bob Stone', avatarUrl: '/avatars/bob.svg' },
        isMine: false,
        createdAt: '2026-10-02T10:00:00Z',
        updatedAt: null,
        ...overrides,
    };
}

type Props = ComponentProps<typeof ItemComments>;

function thread(
    props: Partial<Props> = {},
    mutations = actionItemMutationsFixture(),
) {
    return (
        <ActionItemMutationsContext value={mutations}>
            <ItemComments
                item={actionItemFixture({ isMine: false })}
                endpoints={endpoints}
                revision={0}
                viewer={actionItemViewerFixture()}
                {...props}
            />
        </ActionItemMutationsContext>
    );
}

function answerWith(comments: ActionItemComment[]) {
    retroRequest.mockImplementation(async (route: { method: string }) => {
        if (route.method === 'get') {
            return { comments };
        }

        if (route.method === 'delete') {
            return null;
        }

        return { comment: comment({ id: 'comment-new', isMine: true }) };
    });
}

beforeEach(() => {
    retroRequest.mockReset();
});

describe('ItemComments', () => {
    it('says it is loading, then that there is no comment yet', async () => {
        answerWith([]);
        render(thread());

        expect(screen.getByRole('status').textContent).toContain('Loading…');
        expect(await screen.findByText('No comments yet.')).toBeTruthy();
        expect(retroRequest).toHaveBeenCalledWith({
            url: '/items/item-1/comments',
            method: 'get',
        });
    });

    it('lists the comments with their author and date', async () => {
        answerWith([
            comment(),
            comment({ id: 'comment-2', author: null, content: 'Done.' }),
        ]);
        render(thread());

        expect(await screen.findByText('Started on Monday.')).toBeTruthy();
        expect(screen.getByText('Bob Stone')).toBeTruthy();
        expect(screen.getByText('Former member')).toBeTruthy();
        expect(document.querySelector('time')?.getAttribute('datetime')).toBe(
            '2026-10-02T10:00:00Z',
        );
    });

    it('offers to retry when the comments cannot be loaded', async () => {
        retroRequest.mockRejectedValueOnce(new RetroRequestError(500, 'Down.'));
        render(thread());

        expect(
            await screen.findByText('Could not load the comments.'),
        ).toBeTruthy();

        answerWith([comment()]);
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(await screen.findByText('Started on Monday.')).toBeTruthy();
    });

    it('reports a failed load in place, not as a failed change', async () => {
        retroRequest.mockRejectedValueOnce(new RetroRequestError(500, 'Down.'));

        const run = vi.fn();

        render(thread({}, actionItemMutationsFixture({ run })));

        expect(
            await screen.findByText('Could not load the comments.'),
        ).toBeTruthy();
        expect(run).not.toHaveBeenCalled();
    });

    it('keeps a comment that a reload brought while its own was sent', async () => {
        let answerPost: (value: unknown) => void = () => undefined;

        retroRequest.mockImplementation(async (route: { method: string }) => {
            if (route.method === 'post') {
                return new Promise((resolve) => {
                    answerPost = resolve;
                });
            }

            return { comments: [comment()] };
        });

        const mutations = actionItemMutationsFixture();
        const { rerender } = render(thread({}, mutations));

        await screen.findByText('Started on Monday.');

        fireEvent.change(screen.getByLabelText('Write a comment…'), {
            target: { value: 'On it.' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

        retroRequest.mockImplementation(async () => ({
            comments: [
                comment(),
                comment({ id: 'comment-2', content: 'Me too.' }),
            ],
        }));
        rerender(thread({ revision: 1 }, mutations));

        await screen.findByText('Me too.');

        answerPost({
            comment: comment({
                id: 'comment-new',
                content: 'On it.',
                isMine: true,
            }),
        });

        expect(await screen.findByText('On it.')).toBeTruthy();
        expect(screen.getByText('Me too.')).toBeTruthy();
        expect(mutations.onCommentCount).toHaveBeenCalledWith('item-1', 3);
    });

    it('loads again when the revision moves', async () => {
        answerWith([]);

        const { rerender } = render(thread());

        await screen.findByText('No comments yet.');

        answerWith([comment()]);
        rerender(thread({ revision: 1 }));

        expect(await screen.findByText('Started on Monday.')).toBeTruthy();
    });

    it('adds a comment, empties the field and reports the new count', async () => {
        answerWith([comment()]);

        const mutations = actionItemMutationsFixture();

        render(thread({}, mutations));

        await screen.findByText('Started on Monday.');

        const field = screen.getByLabelText('Write a comment…');

        fireEvent.change(field, { target: { value: '  On it. ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

        await waitFor(() =>
            expect(mutations.onCommentCount).toHaveBeenCalledWith('item-1', 2),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/items/item-1/comments', method: 'post' },
            { content: 'On it.' },
        );
        expect((field as HTMLTextAreaElement).value).toBe('');
    });

    it('does not send an empty comment', async () => {
        answerWith([]);
        render(thread());

        await screen.findByText('No comments yet.');

        expect(
            (
                screen.getByRole('button', {
                    name: 'Comment',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('lets the author edit their comment, and Escape cancels', async () => {
        answerWith([comment({ isMine: true })]);
        render(thread());

        await screen.findByText('Started on Monday.');

        fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));

        const field = screen.getByRole('textbox', { name: 'Edit comment' });

        fireEvent.keyDown(field, { key: 'Escape' });

        expect(
            screen.queryByRole('textbox', { name: 'Edit comment' }),
        ).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Edit comment' }),
            {
                target: { value: 'Started on Tuesday.' },
            },
        );

        retroRequest.mockResolvedValueOnce({
            comment: comment({ isMine: true, content: 'Started on Tuesday.' }),
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('Started on Tuesday.')).toBeTruthy();
        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/comments/comment-1', method: 'patch' },
            { content: 'Started on Tuesday.' },
        );
    });

    it('lets only the author edit, and the author or a manager delete', async () => {
        answerWith([comment()]);

        const { unmount } = render(thread());

        await screen.findByText('Started on Monday.');

        expect(
            screen.queryByRole('button', { name: 'Edit comment' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete comment' }),
        ).toBeNull();

        unmount();
        render(
            thread({
                viewer: actionItemViewerFixture({ isWorkspaceManager: true }),
            }),
        );

        await screen.findByText('Started on Monday.');

        expect(
            screen.queryByRole('button', { name: 'Edit comment' }),
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Delete comment' }),
        ).toBeTruthy();
    });

    it('deletes a comment and reports the new count', async () => {
        answerWith([comment({ isMine: true })]);

        const mutations = actionItemMutationsFixture();

        render(thread({}, mutations));

        await screen.findByText('Started on Monday.');

        fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));

        await waitFor(() =>
            expect(mutations.onCommentCount).toHaveBeenCalledWith('item-1', 0),
        );
        expect(screen.queryByText('Started on Monday.')).toBeNull();
        expect(retroRequest).toHaveBeenCalledWith({
            url: '/comments/comment-1',
            method: 'delete',
        });
    });

    it('is read-only when the viewer may not write', async () => {
        answerWith([comment({ isMine: true })]);
        render(thread({ canWrite: false }));

        await screen.findByText('Started on Monday.');

        expect(screen.queryByLabelText('Write a comment…')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Edit comment' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete comment' }),
        ).toBeNull();
    });

    it('warns that a comment is signed on an anonymous board', async () => {
        answerWith([]);
        render(thread({ showAnonymousNotice: true }));

        expect(
            await screen.findByText(
                'Action items are not anonymous: your name is shown.',
            ),
        ).toBeTruthy();
    });
});
