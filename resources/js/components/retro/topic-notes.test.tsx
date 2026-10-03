import { act, fireEvent, screen } from '@testing-library/react';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GroupNameSuggestionsProvider } from '@/components/retro/board-group';
import { BoardProvider } from '@/components/retro/board-context';
import {
    DiscussionProvider,
    PhaseDiscussing,
} from '@/components/retro/phase-discussing';
import { NoteSaveDelayMs, TopicNotes } from '@/components/retro/topic-notes';
import {
    ActivityContext,
    type RetroActivity,
} from '@/hooks/use-retro-activity';
import type { ActivityEntry } from '@/lib/retro/activity';
import { RetroRequestError } from '@/lib/retro/api';
import type { BoardCard, BoardColumn, TopicNote } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const columns: BoardColumn[] = [
    {
        id: 'start',
        title: 'Start',
        description: null,
        color: 'moss',
        position: 0,
    },
];

function card(id: string, votes: number): BoardCard {
    return {
        id,
        columnId: 'start',
        parentCardId: null,
        position: votes,
        isMine: false,
        hidden: false,
        content: id,
        gif: null,
        author: null,
        groupName: null,
        discussedAt: null,
        votes,
        myVotes: 0,
        reactions: [],
        commentCount: 0,
        comments: [],
        sentiment: null,
        category: null,
    };
}

const note = (body: string, version: number): TopicNote => ({
    cardId: 'a',
    body,
    version,
    updatedAt: null,
});

type Options = {
    notes?: TopicNote[];
    entries?: ActivityEntry[];
    isLocked?: boolean;
    phase?: 'discussing' | 'actions';
};

function activity(entries: ActivityEntry[] = []): RetroActivity {
    return {
        entries,
        writingCount: 0,
        announce: vi.fn(),
        end: vi.fn(),
    };
}

function snapshot({ notes = [], isLocked = false }: Options) {
    return retroSnapshot({
        columns,
        cards: [card('a', 3), card('b', 2)],
        topicNotes: notes,
        retro: { phase: 'discussing', highlightedCardId: 'a', isLocked },
    });
}

function tree(value: RetroActivity) {
    return (
        <ActivityContext value={value}>
            <GroupNameSuggestionsProvider>
                <DiscussionProvider>
                    <PhaseDiscussing hideMyCursor notes={<TopicNotes />} />
                </DiscussionProvider>
            </GroupNameSuggestionsProvider>
        </ActivityContext>
    );
}

function renderNotes(options: Options = {}) {
    const value = activity(options.entries);
    const ctx = boardContext(snapshot(options), {
        online: [
            {
                id: 'me',
                name: 'Alice Martin',
                avatarUrl: '/a.svg',
                isGuest: false,
            },
            {
                id: 'ines',
                name: 'Inès Bernard',
                avatarUrl: '/i.svg',
                isGuest: false,
            },
        ],
    });

    return { activity: value, ...renderInBoard(tree(value), ctx) };
}

const field = () =>
    screen.getByRole('textbox', {
        name: 'Discussion notes',
    }) as HTMLTextAreaElement;

const saveState = (container: HTMLElement) =>
    container.querySelector('[data-slot="retro-topic-notes-state"]')
        ?.textContent;

async function flush(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
    });
}

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
    retroRequest.mockReset();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('TopicNotes', () => {
    it('shows the note of the topic in front of the viewer, saved', () => {
        const { container } = renderNotes({ notes: [note('Ask the PO', 2)] });

        expect(field().value).toBe('Ask the PO');
        expect(field().readOnly).toBe(false);
        expect(saveState(container)).toBe('Saved');
    });

    it('starts empty on a topic without a note', () => {
        const { container } = renderNotes();

        expect(field().value).toBe('');
        expect(field().placeholder).toBe(
            'What the room decides, the questions left open…',
        );
        expect(saveState(container)).toBe('');
    });

    it('saves 800 ms after the last change, from the version it started from', async () => {
        retroRequest.mockResolvedValue({ note: note('Ask the PO first', 3) });

        const { container, ctx, activity } = renderNotes({
            notes: [note('Ask the PO', 2)],
        });

        fireEvent.change(field(), { target: { value: 'Ask the PO f' } });
        act(() => {
            vi.advanceTimersByTime(NoteSaveDelayMs - 100);
        });
        fireEvent.change(field(), { target: { value: 'Ask the PO first' } });
        act(() => {
            vi.advanceTimersByTime(NoteSaveDelayMs - 100);
        });

        expect(retroRequest).not.toHaveBeenCalled();
        expect(activity.announce).toHaveBeenCalledWith('notes', 'a');

        act(() => {
            vi.advanceTimersByTime(100);
        });
        await flush();

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(retroRequest.mock.calls[0][0].url).toContain(
            '/retros/retro-1/cards/a/notes',
        );
        expect(retroRequest.mock.calls[0][1]).toEqual({
            body: 'Ask the PO first',
            version: 2,
        });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'topicNote.set',
            note: note('Ask the PO first', 3),
        });
        expect(saveState(container)).toBe('Saved');
    });

    it('saves at once on blur and ends the announcement', async () => {
        retroRequest.mockResolvedValue({ note: note('x', 1) });

        const { activity } = renderNotes();

        fireEvent.change(field(), { target: { value: 'x' } });
        fireEvent.blur(field());
        await flush();

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(activity.end).toHaveBeenCalledWith('notes', 'a');
    });

    it('takes the server text on a 409 and keeps the own text with Copy', async () => {
        retroRequest.mockRejectedValue(
            new RetroRequestError(
                409,
                'Someone else changed these notes.',
                {},
                {
                    note: note('Their text', 3),
                },
            ),
        );

        const { ctx } = renderNotes({ notes: [note('Base', 2)] });

        fireEvent.change(field(), { target: { value: 'My text' } });
        act(() => {
            vi.advanceTimersByTime(NoteSaveDelayMs);
        });
        await flush();

        expect(field().value).toBe('Their text');

        const conflict = screen
            .getByText('Your text was not saved')
            .closest('[data-slot="retro-topic-notes-conflict"]');

        expect(conflict?.textContent).toContain('My text');
        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'topicNote.set',
            note: note('Their text', 3),
        });
    });

    it('says a failed save and tries again', async () => {
        retroRequest
            .mockRejectedValueOnce(new RetroRequestError(500, 'Down.'))
            .mockResolvedValueOnce({ note: note('x', 1) });

        const { container } = renderNotes();

        fireEvent.change(field(), { target: { value: 'x' } });
        act(() => {
            vi.advanceTimersByTime(NoteSaveDelayMs);
        });
        await flush();

        expect(saveState(container)).toContain('Not saved');

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await flush();

        expect(retroRequest).toHaveBeenCalledTimes(2);
        expect(retroRequest.mock.calls[1][1]).toEqual({
            body: 'x',
            version: 0,
        });
        expect(saveState(container)).toBe('Saved');
    });

    it('tries again from the version the draft was written on, after a newer note from someone else', async () => {
        retroRequest.mockRejectedValueOnce(new RetroRequestError(500, 'Down.'));

        const {
            ctx,
            activity: value,
            rerender,
        } = renderNotes({ notes: [note('Base', 1)] });

        fireEvent.change(field(), { target: { value: 'Mine' } });
        act(() => {
            vi.advanceTimersByTime(NoteSaveDelayMs);
        });
        await flush();

        rerender(
            <BoardProvider
                value={{
                    ...ctx,
                    board: { ...ctx.board, topicNotes: [note('Theirs', 2)] },
                }}
            >
                {tree(value)}
            </BoardProvider>,
        );

        expect(field().value).toBe('Mine');

        retroRequest.mockRejectedValueOnce(
            new RetroRequestError(
                409,
                'Someone else changed these notes.',
                {},
                { note: note('Theirs', 2) },
            ),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        await flush();

        expect(retroRequest.mock.calls[1][1]).toEqual({
            body: 'Mine',
            version: 1,
        });
        expect(field().value).toBe('Theirs');
        expect(
            screen
                .getByText('Your text was not saved')
                .closest('[data-slot="retro-topic-notes-conflict"]')
                ?.textContent,
        ).toContain('Mine');
    });

    it('saves the unsaved text when the topic in front of the viewer changes', async () => {
        retroRequest.mockResolvedValue({ note: note('Last words', 2) });

        const { container, ctx } = renderNotes({ notes: [note('Base', 1)] });

        fireEvent.change(field(), { target: { value: 'Last words' } });
        fireEvent.click(
            container.querySelector(
                '[data-test="retro-topics"] > li[data-topic-id="b"] button',
            ) as HTMLElement,
        );
        await flush();

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(retroRequest.mock.calls[0][0].url).toContain(
            '/retros/retro-1/cards/a/notes',
        );
        expect(retroRequest.mock.calls[0][1]).toEqual({
            body: 'Last words',
            version: 1,
        });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'topicNote.set',
            note: note('Last words', 2),
        });
    });

    it('is read-only while someone else takes notes on the topic', () => {
        renderNotes({
            entries: [
                {
                    senderId: 'ines',
                    kind: 'notes',
                    targetId: 'a',
                    expiresAt: Number.MAX_SAFE_INTEGER,
                },
            ],
        });

        const line = screen.getByText('Inès is taking notes…');

        expect(field().readOnly).toBe(true);
        expect(field().getAttribute('aria-describedby')).toBe(
            line.closest('[data-slot="retro-activity"]')?.parentElement?.id,
        );
    });

    it('stays writable while someone takes notes on another topic', () => {
        renderNotes({
            entries: [
                {
                    senderId: 'ines',
                    kind: 'notes',
                    targetId: 'b',
                    expiresAt: Number.MAX_SAFE_INTEGER,
                },
            ],
        });

        expect(field().readOnly).toBe(false);
    });

    it('is read-only with the reason on a locked board', () => {
        renderNotes({ isLocked: true, notes: [note('Kept', 1)] });

        const reason = screen.getByText('Board closed for editing');

        expect(field().readOnly).toBe(true);
        expect(field().getAttribute('aria-describedby')).toBe(reason.id);
    });

    it('follows a newer note of the board while nothing is unsaved', () => {
        const {
            ctx,
            activity: value,
            rerender,
        } = renderNotes({
            notes: [note('Old', 1)],
        });

        rerender(
            <BoardProvider
                value={{
                    ...ctx,
                    board: { ...ctx.board, topicNotes: [note('New', 2)] },
                }}
            >
                {tree(value)}
            </BoardProvider>,
        );

        expect(field().value).toBe('New');
    });

    it('follows the topic in front of the viewer', () => {
        const { container } = renderNotes({ notes: [note('On a', 1)] });

        fireEvent.click(
            container.querySelector(
                '[data-test="retro-topics"] > li[data-topic-id="b"] button',
            ) as HTMLElement,
        );

        expect(field().value).toBe('');
    });
});
