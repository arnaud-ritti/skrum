import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoryCard } from '@/components/poker/story-card';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const imported = pokerTask('t1', 'Login form', {
    position: 1,
    estimate: '5',
    external: {
        source: 'linear',
        key: 'ENG-1',
        url: 'https://linear.app/acme/issue/ENG-1',
        type: null,
        labels: [],
        isManaged: true,
        assignee: 'Sam Lee',
        sourceEstimate: '2',
        syncState: 'synced',
    },
});

const manual = pokerTask('t2', 'Manual task', { position: 2 });

function story(task = imported) {
    return renderInRoom(
        <StoryCard task={task} />,
        pokerSnapshot({ tasks: [imported, manual] }),
    );
}

describe('StoryCard, an imported task', () => {
    it('opens with the ticket, before the place of the task in the game', () => {
        story();

        const section = document.querySelector<HTMLElement>(
            'section[aria-labelledby="poker-task-t1"]',
        );
        const link = section?.querySelector<HTMLAnchorElement>(
            'a[href="https://linear.app/acme/issue/ENG-1"]',
        );

        expect(link?.textContent).toContain('ENG-1');
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(section?.querySelectorAll('a')).toHaveLength(1);
        expect(
            link?.compareDocumentPosition(
                screen.getByText('1 / 2 in this game'),
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(
            link?.compareDocumentPosition(
                screen.getByRole('heading', { name: 'Login form' }),
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('cannot be edited here, and says what its tracker holds', () => {
        story();

        expect(screen.queryByRole('button', { name: 'Edit task' })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Delete task' }),
        ).toBeTruthy();
        expect(screen.getByText('Assignee: Sam Lee')).toBeTruthy();
        expect(screen.getByText('Linear estimate: 2')).toBeTruthy();
        expect(screen.getByText('Synced to Linear')).toBeTruthy();
    });
});

describe('StoryCard, a task typed in the game', () => {
    it('has no ticket and nothing of a tracker', () => {
        story(manual);

        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText(/managed in/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Edit task' })).toBeTruthy();
    });
});

describe('StoryCard, ticket details and acceptance criteria', () => {
    const detailed = pokerTask('t4', 'CSV export', {
        position: 1,
        descriptionHtml: '<p>As a facilitator I export actions.</p>',
        acceptanceCriteriaHtml: '<ul><li>Filter by period</li></ul>',
        external: {
            source: 'jira',
            key: 'ATLAS-1287',
            url: 'https://acme.atlassian.net/browse/ATLAS-1287',
            type: 'Story',
            labels: ['Actions', 'Export'],
            isManaged: true,
        },
    });

    function render(task: typeof detailed) {
        return renderInRoom(
            <StoryCard task={task} />,
            pokerSnapshot({ tasks: [task] }),
        );
    }

    it('shows the type and the labels right after the key, in order', () => {
        render(detailed);

        const topLine = Array.from(
            document.querySelectorAll(
                '[data-slot="ticket"], [data-slot="ticket-type"], [data-slot="ticket-label"]',
            ),
        ).map((chip) => chip.textContent);

        expect(topLine[0]).toContain('ATLAS-1287');
        expect(topLine.slice(1)).toEqual(['Story', 'Actions', 'Export']);
        const lastLabel = Array.from(
            document.querySelectorAll('[data-slot="ticket-label"]'),
        ).at(-1);

        expect(
            lastLabel?.compareDocumentPosition(
                screen.getByText('1 / 1 in this game'),
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('shows the criteria in their own column beside the description, from the server HTML', () => {
        render(detailed);

        const description = screen.getByText(
            'As a facilitator I export actions.',
        );
        const criteria = document.querySelector(
            '[data-slot="ticket-criteria"]',
        );

        expect(
            description.closest('[data-slot="story-description"]'),
        ).not.toBeNull();
        expect(criteria?.textContent).toContain('Acceptance criteria');
        expect(criteria?.querySelector('li')?.textContent).toBe(
            'Filter by period',
        );
        expect(description.compareDocumentPosition(criteria!)).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
        expect(
            description
                .closest('[data-slot="story-description"]')
                ?.parentElement?.contains(criteria),
        ).toBe(false);
        expect(criteria?.parentElement?.className).toContain(
            'grid-cols-[minmax(0,1fr)_16.25rem]',
        );
    });

    it('shows the criteria of a typed task, and no chips', () => {
        render(
            pokerTask('t5', 'Typed task', {
                acceptanceCriteriaHtml: '<ul><li>Works offline</li></ul>',
            }),
        );

        expect(
            document.querySelector('[data-slot="ticket-criteria"]'),
        ).not.toBeNull();
        expect(document.querySelector('[data-slot="ticket-type"]')).toBeNull();
        expect(document.querySelector('[data-slot="ticket-label"]')).toBeNull();
    });

    it('shows nothing more for an imported task without details or criteria', () => {
        render(
            pokerTask('t6', 'Bare ticket', {
                external: { ...detailed.external!, type: null, labels: [] },
            }),
        );

        expect(document.querySelector('[data-slot="ticket-type"]')).toBeNull();
        expect(document.querySelector('[data-slot="ticket-label"]')).toBeNull();
        expect(
            document.querySelector('[data-slot="ticket-criteria"]'),
        ).toBeNull();
        expect(
            screen.queryByRole('heading', { name: 'Acceptance criteria' }),
        ).toBeNull();
    });

    it('shows the criteria alone when the whole description is the section', () => {
        render({ ...detailed, descriptionHtml: '' });

        expect(
            document.querySelector('[data-slot="story-description"]'),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="ticket-criteria"]'),
        ).not.toBeNull();
    });
});

describe('StoryCard, deleting the task', () => {
    it('asks in an alert dialog, then removes the task', async () => {
        mocks.request.mockResolvedValue(null);
        const { ctx } = story(manual);

        fireEvent.click(screen.getByRole('button', { name: 'Delete task' }));

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Delete this task?',
        });

        expect(
            within(dialog).getByText('Its rounds and votes are deleted too.'),
        ).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Delete' }),
            );
        });

        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.remove',
            taskId: 't2',
        });
    });
});

describe('StoryCard, the rounds of the task', () => {
    const round = {
        id: 'r1',
        number: 1,
        anonymous: false,
        revealedAt: '2026-10-02T09:00:00Z',
        revealReason: 'manual' as const,
        timerEndsAt: null,
        version: 2,
        votesCount: 2,
        votes: [
            { playerId: 'ada', value: '8' },
            { playerId: 'bob', value: '3' },
        ],
        myVote: '8',
        result: {
            average: 5.5,
            mode: [],
            consensus: false,
            nearestCard: '5',
            distribution: [
                { value: '3', count: 1 },
                { value: '8', count: 1 },
            ],
        },
    };
    const voted = pokerTask('t3', 'Voted task', {
        position: 3,
        roundsCount: 1,
    });

    it('lists them open and compact, each vote as "name: value", without a click', async () => {
        mocks.request.mockReset();
        mocks.request.mockResolvedValueOnce([round]);
        renderInRoom(
            <StoryCard task={voted} />,
            pokerSnapshot({ tasks: [voted] }),
        );

        const trigger = screen.getByRole('button', { name: 'Rounds (1)' });

        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(await screen.findByText('Round 1')).toBeTruthy();
        expect(mocks.request).toHaveBeenCalledTimes(1);

        const votes = Array.from(
            document.querySelectorAll('[data-slot="poker-round-vote"]'),
        ).map((vote) => vote.textContent);

        expect(votes).toEqual(['Ada: 8', 'Bob: 3']);
        expect(
            document.querySelector('[data-slot="poker-round-card"]'),
        ).toBeNull();
    });

    it('keeps them folded when asked, and asks the server only once opened', async () => {
        mocks.request.mockReset();
        mocks.request.mockResolvedValueOnce([round]);
        renderInRoom(
            <StoryCard task={voted} roundsOpen={false} />,
            pokerSnapshot({ tasks: [voted] }),
        );

        const trigger = screen.getByRole('button', { name: 'Rounds (1)' });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(mocks.request).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(trigger);
        });

        expect(await screen.findByText('Round 1')).toBeTruthy();
    });

    it('has no rounds list on a task that was never voted', () => {
        story(manual);

        expect(screen.queryByRole('button', { name: /Rounds/ })).toBeNull();
    });
});
