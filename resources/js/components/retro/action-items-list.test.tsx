import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ActionItemsList,
    boardOwnerOptions,
} from '@/components/retro/action-items-list';
import type { BoardContextValue } from '@/components/retro/board-context';
import { actionItemFixture } from '@/test/action-items';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

const phone = vi.hoisted(() => ({ on: false }));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => phone.on,
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('sonner', async (importOriginal) => ({
    ...(await importOriginal<typeof import('sonner')>()),
    toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

type Overrides = Parameters<typeof retroSnapshot>[0];

const people = {
    participants: [
        { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
        { id: 'p-bob', name: 'Bob Stone', avatarUrl: '/b.svg', isGuest: false },
        {
            id: 'p-carol',
            name: 'Carol Guest',
            avatarUrl: '/c.svg',
            isGuest: true,
        },
    ],
    teamMembers: [
        {
            id: 'user-1',
            name: 'Alice Martin',
            avatarUrl: '/a.svg',
            participantId: 'me',
        },
        {
            id: 'user-2',
            name: 'Bob Stone',
            avatarUrl: '/b.svg',
            participantId: 'p-bob',
        },
        {
            id: 'user-3',
            name: 'Dan Rivers',
            avatarUrl: '/d.svg',
            participantId: null,
        },
    ],
};

function list(overrides: Overrides = {}, ctx: Partial<BoardContextValue> = {}) {
    const { retro, ...rest } = overrides;

    return renderInBoard(
        <ActionItemsList />,
        boardContext(
            retroSnapshot({
                ...people,
                ...rest,
                retro: { phase: 'discussing', ...retro },
            }),
            ctx,
        ),
    );
}

const callsTo = (method: string) =>
    retroRequest.mock.calls.filter(([route]) => route.method === method);

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
    phone.on = false;
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
    vi.mocked(toast.success).mockReset();
});

describe('boardOwnerOptions', () => {
    it('lists the people of the retro first, guests included, then the rest of the team', () => {
        expect(
            boardOwnerOptions(people, {
                inRetro: 'In this retro',
                team: 'Team',
            }).map((owner) => [owner.group, owner.kind, owner.id]),
        ).toEqual([
            ['In this retro', 'member', 'user-1'],
            ['In this retro', 'member', 'user-2'],
            ['In this retro', 'guest', 'p-carol'],
            ['Team', 'member', 'user-3'],
        ]);
    });
});

describe('ActionItemsList', () => {
    it('keeps the hooks of the browser suite: the panel, the open form, the id of an item', () => {
        const { container } = list({
            actionItems: [actionItemFixture()],
        });
        const panel = container.querySelector(
            '[data-test="retro-action-items-panel"]',
        ) as HTMLElement;

        expect(
            panel.querySelector('form [aria-label="Add an action item…"]'),
        ).not.toBeNull();
        expect(panel.querySelector('#action-item-item-1')).not.toBeNull();
        expect(
            panel.querySelector(
                '#action-item-item-1 button[aria-controls="action-item-item-1-comments"]',
            )?.textContent,
        ).toBe('0 comments');
        expect(
            within(panel)
                .getByRole('button', { name: 'Create an action' })
                .getAttribute('aria-expanded'),
        ).toBe('true');
    });

    it('says so when the retro has no action item', () => {
        list();

        expect(screen.getByText('No action items yet.')).toBeTruthy();
    });

    it('creates an item on the board endpoint and shows it', async () => {
        const created = actionItemFixture({
            id: 'new',
            content: 'Rotate the on-call',
        });
        retroRequest.mockResolvedValue({ actionItem: created });

        const { ctx } = list();
        const field = screen.getByLabelText('Add an action item…');

        fireEvent.change(field, { target: { value: 'Rotate the on-call' } });
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'actionItem.upsert',
                actionItem: created,
            }),
        );

        const [route, body] = callsTo('post')[0];

        expect(route.url).toContain('/retros/retro-1/action-items');
        expect(body).toMatchObject({
            content: 'Rotate the on-call',
            priority: 'medium',
            due_on: null,
            assignee_user_id: null,
            assignee_participant_id: null,
        });
    });

    it('rings the item just created in the card of the Actions phase, and no other', async () => {
        const created = actionItemFixture({ id: 'new', content: 'New one' });
        retroRequest.mockResolvedValue({ actionItem: created });

        const { container } = renderInBoard(
            <ActionItemsList variant="phase" />,
            boardContext(
                retroSnapshot({
                    ...people,
                    actionItems: [actionItemFixture(), created],
                    retro: { phase: 'actions' },
                }),
            ),
        );
        const field = screen.getByLabelText('Add an action item…');

        fireEvent.change(field, { target: { value: 'New one' } });
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() =>
            expect(
                container.querySelector('#action-item-new')?.className,
            ).toContain('ring-skrum-success'),
        );
        expect(
            container.querySelector('#action-item-item-1')?.className,
        ).not.toContain('ring-skrum-success');
    });

    it('says nothing after a creation in the panel of the discussion', async () => {
        const created = actionItemFixture({ id: 'new' });
        retroRequest.mockResolvedValue({ actionItem: created });

        const { ctx, container } = list({ actionItems: [created] });
        const field = screen.getByLabelText('Add an action item…');

        fireEvent.change(field, { target: { value: 'New one' } });
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() => expect(ctx.apply).toHaveBeenCalled());
        expect(toast.success).not.toHaveBeenCalled();
        expect(
            container.querySelector('#action-item-new')?.className,
        ).not.toContain('ring-skrum-success');
    });

    it('lists the items it keeps under its title, and the rest folded under "Other action items (n)"', () => {
        const { container } = renderInBoard(
            <ActionItemsList
                title="Topic actions"
                filter={(item) => item.cardId === 'card-2'}
            />,
            boardContext(
                retroSnapshot({
                    ...people,
                    actionItems: [
                        actionItemFixture({ id: 'mine', cardId: 'card-2' }),
                        actionItemFixture({ id: 'other', cardId: null }),
                        actionItemFixture({ id: 'third', cardId: 'card-3' }),
                    ],
                    retro: { phase: 'discussing' },
                }),
            ),
        );

        expect(
            screen.getByRole('heading', { name: 'Topic actions' }),
        ).toBeTruthy();
        expect(container.querySelector('#action-item-mine')).not.toBeNull();
        expect(container.querySelector('#action-item-other')).toBeNull();

        const others = screen.getByRole('button', {
            name: 'Other action items (2)',
        });

        expect(others.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(others);

        expect(container.querySelector('#action-item-other')).not.toBeNull();
        expect(container.querySelector('#action-item-third')).not.toBeNull();
    });

    it('creates the item linked to the card it is given', async () => {
        renderInBoard(
            <ActionItemsList
                linkedTo={{ cardId: 'card-2', label: 'Linked to #2 · Scope' }}
            />,
            boardContext(retroSnapshot({ ...people })),
        );

        const form = screen.getByRole('form', { name: 'New action item' });
        const field = within(form).getByLabelText('Add an action item…');

        expect(within(form).getByText('Linked to #2 · Scope')).toBeTruthy();

        fireEvent.change(field, { target: { value: 'One in, one out' } });
        fireEvent.submit(form);

        await waitFor(() => expect(callsTo('post')).toHaveLength(1));
        expect(callsTo('post')[0][1]).toMatchObject({ card_id: 'card-2' });
    });

    it('says what the quick add of the Actions card is linked to in place of "Quick add"', () => {
        renderInBoard(
            <ActionItemsList
                variant="phase"
                linkedTo={{
                    cardId: 'card-1',
                    label: 'Quick add · linked to «CI»',
                }}
            />,
            boardContext(
                retroSnapshot({ ...people, retro: { phase: 'actions' } }),
            ),
        );

        expect(screen.getByText('Quick add · linked to «CI»')).toBeTruthy();
        expect(screen.queryByText('Quick add')).toBeNull();
    });

    it('closes the form with "Create an action" and with Cancel', () => {
        list();

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByLabelText('Add an action item…')).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Create an action' }),
        );

        expect(screen.getByLabelText('Add an action item…')).toBeTruthy();
    });

    it('asks before deleting, and deletes on confirmation only', async () => {
        const item = actionItemFixture();
        const { ctx } = list({ actionItems: [item] });

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete action item' }),
        );

        const dialog = screen.getByRole('alertdialog');

        expect(dialog.textContent).toContain('Delete this action item?');
        expect(callsTo('delete')).toHaveLength(0);

        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(callsTo('delete')).toHaveLength(1));
        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'actionItem.remove',
                actionItemId: 'item-1',
            }),
        );
    });

    it('marks an item as done', async () => {
        const item = actionItemFixture();
        retroRequest.mockResolvedValue({
            actionItem: { ...item, status: 'completed' },
        });

        list({ actionItems: [item] });

        fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));

        await waitFor(() =>
            expect(callsTo('patch')[0]?.[1]).toEqual({ status: 'completed' }),
        );
    });

    it('edits an item in place: the assignee is chosen among the people of the retro and the team', async () => {
        const item = actionItemFixture();
        retroRequest.mockResolvedValue({ actionItem: item });

        list({ actionItems: [item] });

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        const editor = document.querySelector(
            '#action-item-item-1',
        ) as HTMLElement;

        fireEvent.keyDown(
            within(editor).getByRole('combobox', { name: 'Assignee' }),
            { key: 'ArrowDown' },
        );

        expect(
            within(
                screen.getByRole('group', { name: 'In this retro' }),
            ).getByRole('option', { name: 'Carol Guest (Guest)' }),
        ).toBeTruthy();
        expect(
            within(screen.getByRole('group', { name: 'Team' })).getByRole(
                'option',
                { name: 'Dan Rivers' },
            ),
        ).toBeTruthy();

        fireEvent.keyDown(
            screen.getByRole('option', { name: 'Carol Guest (Guest)' }),
            { key: 'Enter' },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(callsTo('patch')[0]?.[1]).toEqual({
                assignee_user_id: null,
                assignee_participant_id: 'p-carol',
            }),
        );
        expect(
            within(editor).queryByRole('combobox', { name: 'Assignee' }),
        ).toBeNull();
    });

    it('names the assignee beside the item, a guest as one', () => {
        list({
            actionItems: [
                actionItemFixture({
                    assignee: {
                        kind: 'guest',
                        id: 'p-carol',
                        name: 'Carol Guest',
                        avatarUrl: '/c.svg',
                        isTeamMember: false,
                    },
                }),
            ],
        });

        expect(
            document.querySelector('[data-slot="action-item-owner-name"]')
                ?.textContent,
        ).toBe('Carol Guest (Guest)');
    });

    it('shows edit and delete to who manages the item only, and lets the others tick nothing', () => {
        list({
            viewer: { participantId: 'p-bob', userId: 'user-2' },
            actionItems: [actionItemFixture({ isMine: false })],
        });

        expect(
            screen.queryByRole('button', { name: 'Edit action item' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete action item' }),
        ).toBeNull();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Mark as done',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('takes no change on a board closed for editing', () => {
        list({
            retro: { isLocked: true },
            actionItems: [actionItemFixture()],
        });

        expect(
            (screen.getByLabelText('Add an action item…') as HTMLInputElement)
                .disabled,
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Mark as done',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen.queryByRole('button', { name: 'Edit action item' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete action item' }),
        ).toBeNull();
    });

    it('warns that action items are not anonymous on an anonymous retro', () => {
        list({ retro: { isAnonymous: true } });

        expect(
            screen.getByText(
                'Action items are not anonymous: your name is shown.',
            ),
        ).toBeTruthy();
    });

    it('creates the item, then opens the export on it when the ticket is asked for', async () => {
        const created = actionItemFixture({
            id: 'new',
            content: 'Rotate the on-call',
        });
        retroRequest.mockImplementation(async (route: { method: string }) =>
            route.method === 'post' ? { actionItem: created } : null,
        );

        list({
            exportSources: [
                {
                    source: 'linear',
                    label: 'Linear',
                    integrationId: 'integration-1',
                },
            ],
        });

        const field = screen.getByLabelText('Add an action item…');

        fireEvent.change(field, { target: { value: 'Rotate the on-call' } });
        fireEvent.click(
            screen.getByRole('checkbox', {
                name: 'Create the ticket in Linear',
            }),
        );
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        const dialog = await screen.findByRole('dialog');

        expect(dialog.textContent).toContain('Linear');
        expect(callsTo('post')).toHaveLength(1);
    });

    it('offers no ticket to a guest, who cannot export', () => {
        list({
            viewer: { userId: null, isGuest: true },
            exportSources: [
                {
                    source: 'linear',
                    label: 'Linear',
                    integrationId: 'integration-1',
                },
            ],
        });

        expect(
            screen.queryByRole('checkbox', {
                name: 'Create the ticket in Linear',
            }),
        ).toBeNull();
    });
});

describe('ActionItemsList on a phone', () => {
    beforeEach(() => {
        phone.on = true;
    });

    it('creates an item from the drawer, with the assignee picked among the avatar chips, and closes it', async () => {
        const created = actionItemFixture({
            id: 'new-item',
            content: 'Quarantine the flaky tests',
        });

        retroRequest.mockResolvedValue({ actionItem: created });

        const { container, ctx } = list();

        expect(
            container.querySelector('[data-slot="item-create-form"]'),
        ).toBeNull();

        const trigger = screen.getByRole('button', {
            name: 'Create an action',
        });

        expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
        fireEvent.click(trigger);

        const drawer = await screen.findByRole('dialog', {
            name: 'New action item',
        });
        const assignees = within(drawer).getByRole('radiogroup', {
            name: 'Assignee',
        });

        expect(
            within(assignees)
                .getAllByRole('radio')
                .map((chip) => chip.textContent),
        ).toEqual([
            'Unassigned',
            expect.stringContaining('Alice Martin'),
            expect.stringContaining('Bob Stone'),
            expect.stringContaining('Carol Guest'),
            expect.stringContaining('Dan Rivers'),
        ]);

        fireEvent.click(
            within(assignees).getByRole('radio', { name: /Bob Stone/ }),
        );
        fireEvent.click(
            within(
                within(drawer).getByRole('radiogroup', { name: 'Priority' }),
            ).getByRole('radio', { name: 'High' }),
        );
        fireEvent.change(within(drawer).getByLabelText('Add an action item…'), {
            target: { value: 'Quarantine the flaky tests' },
        });
        fireEvent.click(within(drawer).getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'actionItem.upsert',
                actionItem: created,
            }),
        );
        expect(callsTo('post')[0][1]).toMatchObject({
            content: 'Quarantine the flaky tests',
            priority: 'high',
            assignee_user_id: 'user-2',
        });
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'New action item' }),
            ).toBeNull(),
        );
    });

    it('keeps the drawer open when the server refuses the item', async () => {
        retroRequest.mockRejectedValue(new Error('refused'));

        list();

        fireEvent.click(
            screen.getByRole('button', { name: 'Create an action' }),
        );

        const drawer = await screen.findByRole('dialog', {
            name: 'New action item',
        });

        fireEvent.change(within(drawer).getByLabelText('Add an action item…'), {
            target: { value: 'Quarantine the flaky tests' },
        });
        fireEvent.click(within(drawer).getByRole('button', { name: 'Create' }));

        await waitFor(() => expect(callsTo('post')).toHaveLength(1));
        expect(
            screen.getByRole('dialog', { name: 'New action item' }),
        ).toBeTruthy();
    });
});
