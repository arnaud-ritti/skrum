import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    CommentThreadList,
    type CommentThreadActions,
    type ThreadComment,
    type ThreadWithReplies,
} from '@/components/retro/comment-thread';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

function comment(overrides: Partial<ThreadComment> = {}): ThreadComment {
    return {
        id: 'm1',
        parentCommentId: null,
        isMine: false,
        deleted: false,
        content: 'Which pipeline is slow?',
        author: { id: 'bob', name: 'Bob Stone' },
        createdAt: '2026-10-02T10:00:00Z',
        ...overrides,
    };
}

function thread(
    overrides: Partial<ThreadWithReplies<ThreadComment>> = {},
): ThreadWithReplies<ThreadComment> {
    return { ...comment(), replies: [], ...overrides };
}

function actions(): CommentThreadActions<ThreadComment> {
    return {
        create: vi.fn().mockResolvedValue(true),
        update: vi.fn().mockResolvedValue(true),
        remove: vi.fn().mockResolvedValue(undefined),
    };
}

function threads(
    list: ThreadWithReplies<ThreadComment>[],
    {
        canWrite = true,
        isFacilitator = false,
        composerNote,
        handlers = actions(),
    }: {
        canWrite?: boolean;
        isFacilitator?: boolean;
        composerNote?: string;
        handlers?: CommentThreadActions<ThreadComment>;
    } = {},
) {
    return {
        handlers,
        ...renderInBoard(
            <CommentThreadList
                threads={list}
                canWrite={canWrite}
                actions={handlers}
                composerNote={composerNote}
            />,
            boardContext(retroSnapshot({ viewer: { isFacilitator } })),
        ),
    };
}

describe('CommentThreadList', () => {
    it('writes a comment with Enter and empties the field, and keeps Shift+Enter for a new line', async () => {
        const { handlers } = threads([]);
        const field = screen.getByLabelText(
            'Write a comment…',
        ) as HTMLTextAreaElement;

        fireEvent.change(field, { target: { value: ' Hello ' } });
        fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });

        expect(handlers.create).not.toHaveBeenCalled();

        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() => expect(field.value).toBe(''));
        expect(handlers.create).toHaveBeenCalledWith('Hello', null);
    });

    it('keeps what was typed when the server refuses', async () => {
        const handlers = actions();

        handlers.create = vi.fn().mockResolvedValue(false);
        threads([], { handlers });

        const field = screen.getByLabelText(
            'Write a comment…',
        ) as HTMLTextAreaElement;

        fireEvent.change(field, { target: { value: 'Hello' } });
        fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

        await waitFor(() => expect(handlers.create).toHaveBeenCalled());
        expect(field.value).toBe('Hello');
    });

    it('names the author in a paragraph, and says "Anonymous" without one', () => {
        const { container } = threads([
            thread(),
            thread({ id: 'm2', author: null, content: 'Same here' }),
        ]);
        const names = [
            ...container.querySelectorAll(
                '[data-slot="comment"] p:first-child',
            ),
        ].map((name) => name.textContent);

        expect(names).toEqual(['Bob Stone', 'Anonymous']);
    });

    it('folds the replies behind their count, and opens the reply field under the thread', async () => {
        const { handlers } = threads([
            thread({
                replies: [
                    comment({
                        id: 'r1',
                        parentCommentId: 'm1',
                        content: 'The deploy one.',
                    }),
                ],
            }),
        ]);
        const toggle = screen.getByRole('button', { name: '1 reply' });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('The deploy one.')).toBeNull();

        fireEvent.click(toggle);

        expect(screen.getByText('The deploy one.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

        const field = screen.getByLabelText('Write a reply…');

        fireEvent.change(field, { target: { value: 'Thanks' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(screen.queryByLabelText('Write a reply…')).toBeNull(),
        );
        expect(handlers.create).toHaveBeenCalledWith('Thanks', 'm1');
    });

    it('lets me edit and delete my comment, and nobody else', async () => {
        const mine = thread({ isMine: true });
        const { handlers } = threads([
            mine,
            thread({ id: 'm2', content: 'Same here' }),
        ]);

        expect(
            screen.getAllByRole('button', { name: 'Edit comment' }),
        ).toHaveLength(1);
        expect(
            screen.getAllByRole('button', { name: 'Delete comment' }),
        ).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));

        const field = screen.getByRole('textbox', {
            name: 'Edit comment',
        }) as HTMLTextAreaElement;

        expect(field.value).toBe('Which pipeline is slow?');

        fireEvent.change(field, { target: { value: 'Which one?' } });
        fireEvent.keyDown(field, { key: 'Enter' });

        await waitFor(() =>
            expect(handlers.update).toHaveBeenCalledWith(mine, 'Which one?'),
        );
    });

    it('lets the facilitator delete any comment, once', async () => {
        const target = thread({
            replies: [comment({ id: 'r1', parentCommentId: 'm1' })],
        });
        const { handlers } = threads([target], { isFacilitator: true });

        expect(
            screen.queryByRole('button', { name: 'Edit comment' }),
        ).toBeNull();

        const remove = screen.getByRole('button', { name: 'Delete comment' });

        fireEvent.click(remove);
        fireEvent.click(remove);

        await waitFor(() =>
            expect(handlers.remove).toHaveBeenCalledWith(target, true),
        );
        expect(handlers.remove).toHaveBeenCalledOnce();
    });

    it('keeps a deleted comment as a line above its replies, without a reply button', () => {
        threads([
            thread({
                deleted: true,
                content: null,
                replies: [comment({ id: 'r1', parentCommentId: 'm1' })],
            }),
        ]);

        expect(screen.getByText('Comment deleted')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    });

    it('is read-only without the right to write', () => {
        const { container } = threads([thread({ isMine: true })], {
            canWrite: false,
            composerNote: 'Your name is shown with your comment.',
        });

        expect(container.querySelector('textarea')).toBeNull();
        expect(container.querySelectorAll('button')).toHaveLength(0);
        expect(
            screen.queryByText('Your name is shown with your comment.'),
        ).toBeNull();
    });

    it('says that nothing was written when the thread is empty and closed', () => {
        threads([], { canWrite: false });

        expect(screen.getByText('No comments yet.')).toBeTruthy();
    });

    it('shows the note of its host above the field', () => {
        threads([], { composerNote: 'Your name is shown with your comment.' });

        expect(
            screen.getByText('Your name is shown with your comment.'),
        ).toBeTruthy();
    });
});
