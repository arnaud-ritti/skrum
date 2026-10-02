import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import {
    CarriedItemsSheet,
    groupCarriedActionItems,
    showsCarriedItems,
} from '@/components/retro/carried-items-sheet';
import { actionItemFixture } from '@/test/action-items';
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

const fromSprint = (id: string, sprint: string, createdAt: string) =>
    actionItemFixture({
        id,
        retroId: sprint,
        content: `Item ${id}`,
        source: {
            retroTitle: sprint,
            retroCreatedAt: createdAt,
            retroUrl: '/retros/earlier',
        },
    });

const carried = [
    fromSprint('a', 'Sprint 10', '2026-09-01T10:00:00Z'),
    actionItemFixture({ id: 'loose', retroId: null, content: 'Loose item' }),
    fromSprint('b', 'Sprint 11', '2026-09-15T10:00:00Z'),
    fromSprint('c', 'Sprint 10', '2026-09-01T10:00:00Z'),
];

type Overrides = Parameters<typeof retroSnapshot>[0];

function sheet(
    overrides: Overrides = {},
    ctx: Parameters<typeof boardContext>[1] = {},
) {
    return renderInBoard(
        <CarriedItemsSheet />,
        boardContext(
            retroSnapshot({
                carriedActionItems: carried,
                links: {
                    team: '/teams/team-1',
                    actionItems: '/acme/action-items?team=team-1',
                    workspace: 'acme',
                },
                ...overrides,
            }),
            ctx,
        ),
    );
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'clear'> {
    const values = new Map<string, string>();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        clear: () => values.clear(),
    };
}

const callsTo = (method: string) =>
    retroRequest.mock.calls.filter(([route]) => route.method === method);

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
    // The storage of the test environment goes missing on some runs of
    // several files: the sheet gets one of its own.
    vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('groupCarriedActionItems', () => {
    it('makes one group per retro, the newest first, and puts the items added outside a retro last', () => {
        expect(
            groupCarriedActionItems(carried).map((group) => [
                group.key,
                group.items.map((item) => item.id),
            ]),
        ).toEqual([
            ['Sprint 11', ['b']],
            ['Sprint 10', ['a', 'c']],
            ['outside', ['loose']],
        ]);
    });
});

describe('showsCarriedItems', () => {
    it('is for the members of the team, on an open retro that has follow-ups', () => {
        const shows = (overrides: Overrides = {}) =>
            showsCarriedItems(
                retroSnapshot({ carriedActionItems: carried, ...overrides }),
            );

        expect(shows()).toBe(true);
        expect(shows({ viewer: { isGuest: true } })).toBe(false);
        expect(shows({ retro: { phase: 'completed' } })).toBe(false);
        expect(shows({ carriedActionItems: [] })).toBe(false);
        expect(
            shows({
                links: { team: null, actionItems: null, workspace: null },
            }),
        ).toBe(false);
    });
});

describe('CarriedItemsSheet', () => {
    it('opens by itself the first time the board is seen in Writing, and counts the open items on its button', () => {
        sheet({
            carriedActionItems: [
                ...carried,
                actionItemFixture({ id: 'done', status: 'completed' }),
            ],
        });

        const dialog = screen.getByRole('dialog');

        expect(
            screen.getByRole('button', {
                name: 'Previous action items (4)',
                hidden: true,
            }),
        ).toBeTruthy();
        expect(dialog.textContent).toContain('Previous action items');
        expect(dialog.textContent).toContain('Sprint 11');
        expect(dialog.textContent).toContain('Added outside a retro');
        expect(dialog.querySelector('#action-item-a')).not.toBeNull();
        // The heading names the retro: a row does not repeat it.
        expect(
            dialog.querySelector('#action-item-b')?.textContent,
        ).not.toContain('Sprint 11');
        expect(window.localStorage.getItem('skrum.carriedSeen.retro-1')).toBe(
            'true',
        );
    });

    it('is closed once the session has expired', () => {
        sheet({}, { sessionExpired: true });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('stays closed once seen, and when the board is first opened after Writing', () => {
        window.localStorage.setItem('skrum.carriedSeen.retro-1', 'true');

        const seen = sheet();

        expect(screen.queryByRole('dialog')).toBeNull();

        seen.unmount();
        window.localStorage.clear();
        sheet({ retro: { phase: 'discussing' } });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            window.localStorage.getItem('skrum.carriedSeen.retro-1'),
        ).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Previous action items (4)' }),
        );

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog)
                .getByRole('link', { name: 'Open the action items page' })
                .getAttribute('href'),
        ).toBe('/acme/action-items?team=team-1');
    });

    it('renders nothing for a guest, nor once the retro is completed', () => {
        const guest = sheet({ viewer: { isGuest: true } });

        expect(guest.container.innerHTML).toBe('');

        guest.unmount();

        const completed = sheet({ retro: { phase: 'completed' } });

        expect(completed.container.innerHTML).toBe('');
    });

    it('ticks a follow-up through the workspace route and keeps it in the list', async () => {
        const done = { ...carried[0], status: 'completed' as const };
        retroRequest.mockResolvedValue({ actionItem: done });

        const { ctx } = sheet();
        const row = screen
            .getByRole('dialog')
            .querySelector('#action-item-a') as HTMLElement;

        fireEvent.click(
            within(row).getByRole('button', { name: 'Mark as done' }),
        );

        await waitFor(() => expect(callsTo('patch')).toHaveLength(1));
        expect(callsTo('patch')[0][0].url).toContain('/acme/action-items/a');
        expect(callsTo('patch')[0][1]).toEqual({ status: 'completed' });
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'carriedActionItem.upsert',
                actionItem: done,
            }),
        );
    });

    it('says when there are more on the action items page', () => {
        sheet({ carriedActionItemsHasMore: true });

        expect(
            within(screen.getByRole('dialog')).getByRole('link', {
                name: 'View all on the action items page',
            }),
        ).toBeTruthy();
    });
});
