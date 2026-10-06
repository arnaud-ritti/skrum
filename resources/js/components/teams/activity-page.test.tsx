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
    currentTeam: { canCreateSession: true },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({
            props: {
                translations: {},
                locale: 'en',
                currentTeam: mocks.currentTeam,
            },
        }),
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
        mocks.currentTeam = { canCreateSession: true };
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

        expect(screen.getAllByRole('option')).toEqual(
            ['Anyone', 'Ada Admin', 'Max Member'].map((name) =>
                screen.getByRole('option', { name }),
            ),
        );

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

    it("shows each person's avatar in the filter and on the chosen value, and none for Anyone", async () => {
        const avatar = (element: Element) =>
            element.querySelector('[data-slot="person-avatar"]');
        const { unmount } = page();
        const select = screen.getByRole('combobox', { name: 'Member' });

        expect(avatar(select)).toBeNull();

        await userEvent.click(select);

        expect(
            avatar(screen.getByRole('option', { name: 'Anyone' })),
        ).toBeNull();

        for (const name of ['Ada Admin', 'Max Member']) {
            const drawn = avatar(screen.getByRole('option', { name }));

            expect(drawn).not.toBeNull();
            expect(drawn?.getAttribute('aria-hidden')).toBe('true');
        }

        unmount();
        page({ filters: { group: null, actor: 'u2', day: null } });

        const chosen = screen.getByRole('combobox', { name: 'Member' });

        expect(avatar(chosen)).not.toBeNull();
        expect(chosen.textContent).toContain('Max Member');
    });

    it('shows the centred empty state with Clear filters when nothing matches', () => {
        const { container } = page({
            lines: [],
            total: 0,
            filters: { group: 'actions', actor: null, day: null },
        });
        const empty = container.querySelector('[data-slot="empty-state"]');

        expect(empty?.textContent).toContain('Activity');
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'No activity matches these filters',
            }),
        ).toBeTruthy();
        expect(
            screen.getByText('Try another kind, person or day.'),
        ).toBeTruthy();
        expect(
            empty?.querySelector('[data-slot="empty-state-art"]'),
        ).not.toBeNull();
        expect(
            screen
                .getByRole('link', { name: 'Clear filters' })
                .getAttribute('href'),
        ).toBe(Address);
        expect(screen.queryByRole('link', { name: 'New session' })).toBeNull();
    });

    it('shows the centred empty state with New session when nothing ever happened', () => {
        const { container, unmount } = page({ lines: [], total: 0 });

        expect(
            container.querySelector('[data-slot="empty-state"]'),
        ).not.toBeNull();
        expect(
            screen.getByRole('heading', {
                level: 2,
                name: 'Nothing has happened in this team yet.',
            }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Sessions, completed actions and new members show up here.',
            ),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'New session' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/t1?new=session');
        expect(
            screen.queryByRole('link', { name: 'Clear filters' }),
        ).toBeNull();

        unmount();
        mocks.currentTeam = { canCreateSession: false };
        page({ lines: [], total: 0 });

        expect(screen.queryByRole('link', { name: 'New session' })).toBeNull();
    });
});
