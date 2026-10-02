import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoryCard } from '@/components/poker/story-card';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

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
