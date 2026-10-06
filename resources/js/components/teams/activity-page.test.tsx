import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityPage } from '@/components/teams/activity-page';
import type { ActivityPageProps } from '@/components/teams/activity-page';
import { renderWithProviders } from '@/test/render';
import type { TeamActivityLine } from '@/types';

const mocks = vi.hoisted(() => ({
    reload: vi.fn(),
    visit: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { reload: mocks.reload, visit: mocks.visit },
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

function line(
    id: string,
    at: string,
    values: Partial<TeamActivityLine> = {},
): TeamActivityLine {
    return {
        id,
        kind: 'member_joined',
        actor: { name: 'Max Member', avatarUrl: null },
        subject: null,
        at,
        day: at.slice(0, 10),
        ...values,
    };
}

const base: ActivityPageProps = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    team: { id: 't1', name: 'Atlas' },
    lines: [
        line('a', '2026-10-06T07:10:00+00:00', {
            kind: 'action_item_completed',
            actor: { name: 'Ada Admin', avatarUrl: null },
            subject: { title: 'Fix CI', url: '/actions?team=t1' },
        }),
        line('b', '2026-10-05T18:02:00+00:00'),
        line('c', '2026-10-03T09:12:00+00:00'),
    ],
    total: 3,
    nextCursor: null,
    filters: { group: null, actor: null, day: null },
    members: [
        { id: 'u1', name: 'Ada Admin', avatarUrl: null },
        { id: 'u2', name: 'Max Member', avatarUrl: null },
    ],
    today: '2026-10-06',
};

const Address = '/w/nordlys/teams/t1/activity';

function page(props: Partial<ActivityPageProps> = {}) {
    return renderWithProviders(<ActivityPage {...base} {...props} />);
}

describe('the Activity page', () => {
    beforeAll(() => {
        Element.prototype.hasPointerCapture = () => false;
        Element.prototype.setPointerCapture = () => {};
        Element.prototype.releasePointerCapture = () => {};
        Element.prototype.scrollIntoView = () => {};
    });

    beforeEach(() => {
        mocks.reload.mockReset();
        mocks.visit.mockReset();
    });

    it('titles the page and lists the lines under their day', () => {
        page();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Activity' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Everything that happened in Atlas'),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('heading', { level: 2 })
                .map((heading) => heading.textContent),
        ).toEqual(['Today', 'Yesterday', 'Oct 3']);
        expect(
            screen.getByRole('link', { name: 'Fix CI' }).getAttribute('href'),
        ).toBe('/actions?team=t1');
    });

    it('shows the time of day beside each line', () => {
        const { container } = page();
        const times = Array.from(container.querySelectorAll('time'));

        expect(times.map((time) => time.textContent)).toEqual([
            '7:10 AM',
            '6:02 PM',
            '9:12 AM',
        ]);
        expect(times[0].getAttribute('datetime')).toBe(
            '2026-10-06T07:10:00+00:00',
        );
        expect(
            container.querySelectorAll('[data-test="activity-line"]')[0]
                .textContent,
        ).toContain('Ada Admin completed Fix CI');
    });

    it('marks the active chip and keeps the other filters in its link', () => {
        page({ filters: { group: 'actions', actor: 'u1', day: '2026-10-05' } });

        const chips = within(
            screen.getByRole('navigation', { name: 'Kinds' }),
        ).getAllByRole('link');

        expect(chips.map((chip) => chip.textContent)).toEqual([
            'All',
            'Sessions',
            'Actions',
            'Members',
        ]);
        expect(chips.map((chip) => chip.getAttribute('aria-current'))).toEqual([
            null,
            null,
            'page',
            null,
        ]);
        expect(chips.map((chip) => chip.getAttribute('href'))).toEqual([
            `${Address}?actor=u1&day=2026-10-05`,
            `${Address}?group=sessions&actor=u1&day=2026-10-05`,
            `${Address}?group=actions&actor=u1&day=2026-10-05`,
            `${Address}?group=members&actor=u1&day=2026-10-05`,
        ]);
    });

    it("asks for a member's lines", async () => {
        page({ filters: { group: 'sessions', actor: null, day: null } });

        const select = screen.getByRole('combobox', { name: 'Member' });

        expect(select.textContent).toBe('Anyone');

        await userEvent.click(select);

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Anyone', 'Ada Admin', 'Max Member']);

        await userEvent.click(
            screen.getByRole('option', { name: 'Ada Admin' }),
        );

        expect(mocks.visit).toHaveBeenLastCalledWith(
            `${Address}?group=sessions&actor=u1`,
        );
    });

    it('asks for one day, and for any day again', async () => {
        const { unmount } = page({
            filters: { group: null, actor: 'u2', day: null },
        });

        expect(screen.getByRole('button', { name: /Day/ }).textContent).toBe(
            'Any day',
        );

        await userEvent.click(screen.getByRole('button', { name: /Day/ }));
        await userEvent.click(
            screen.getByRole('button', { name: /Yesterday/ }),
        );

        expect(mocks.visit).toHaveBeenLastCalledWith(
            `${Address}?actor=u2&day=2026-10-05`,
        );

        unmount();
        page({ filters: { group: null, actor: 'u2', day: '2026-10-05' } });

        await userEvent.click(screen.getByRole('button', { name: /Day/ }));
        await userEvent.click(screen.getByRole('button', { name: /Any day/ }));

        expect(mocks.visit).toHaveBeenLastCalledWith(`${Address}?actor=u2`);
    });

    it('asks for the next page with the filters', async () => {
        page({
            total: 65,
            nextCursor: 'cursor-1',
            filters: { group: 'members', actor: 'u2', day: '2026-10-05' },
        });

        await userEvent.click(
            screen.getByRole('button', { name: /Load more/ }),
        );

        expect(mocks.reload).toHaveBeenCalledTimes(1);
        expect(mocks.reload.mock.calls[0][0]).toMatchObject({
            only: ['lines', 'nextCursor'],
            data: {
                group: 'members',
                actor: 'u2',
                day: '2026-10-05',
                before: 'cursor-1',
            },
        });
    });

    it('counts what is left to load, and says so once everything is shown', () => {
        const { unmount } = page({ total: 65, nextCursor: 'cursor-1' });

        expect(
            screen.getByRole('button', { name: /Load more/ }).textContent,
        ).toContain('62 more');

        unmount();
        page();

        expect(
            screen.getByText("You're all caught up · 3 events"),
        ).toBeTruthy();
    });

    it('says nothing has happened, or that nothing matches with a way to clear', () => {
        const { unmount } = page({ lines: [], total: 0 });

        expect(
            screen.getByText('Nothing has happened in this team yet.'),
        ).toBeTruthy();
        expect(
            screen.queryByRole('link', { name: 'Clear filters' }),
        ).toBeNull();

        unmount();
        page({
            lines: [],
            total: 0,
            filters: { group: 'actions', actor: null, day: null },
        });

        expect(screen.getByText('No activity matches.')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Clear filters' })
                .getAttribute('href'),
        ).toBe(Address);
    });
});
