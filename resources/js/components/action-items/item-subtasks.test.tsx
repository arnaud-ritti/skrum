import {
    createEvent,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemSubtasks } from '@/components/action-items/item-subtasks';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import { RetroRequestError } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import {
    actionItemEndpointsFixture,
    actionItemFixture,
    actionItemMutationsFixture,
} from '@/test/action-items';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const endpoints = actionItemEndpointsFixture();

function withSubtasks(count = 3): ActionItem {
    return actionItemFixture({
        subtasks: ['Find the flaky tests', 'Tag them', 'Open a ticket']
            .slice(0, count)
            .map((content, position) => ({
                id: `subtask-${position + 1}`,
                content,
                isCompleted: position === 0,
                position,
            })),
    });
}

function renderSubtasks(
    ui: ReactElement,
    mutations = actionItemMutationsFixture(),
) {
    render(
        <ActionItemMutationsContext value={mutations}>
            {ui}
        </ActionItemMutationsContext>,
    );

    return mutations;
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ actionItem: actionItemFixture() });
});

describe('ItemSubtasks', () => {
    it('lists the sub-tasks in order, each a checkbox named by its text', () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        const list = screen.getByRole('list', { name: 'Sub-tasks' });
        const boxes = Array.from(list.querySelectorAll('[role="checkbox"]'));

        expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
            'Find the flaky tests',
            'Tag them',
            'Open a ticket',
        ]);
        expect(boxes.map((box) => box.getAttribute('aria-checked'))).toEqual([
            'true',
            'false',
            'false',
        ]);
    });

    it('ticks a sub-task and hands the saved item back', async () => {
        const saved = actionItemFixture({ content: 'Saved' });

        retroRequest.mockResolvedValue({ actionItem: saved });

        const mutations = renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage={false}
                canComplete
            />,
        );

        fireEvent.click(screen.getByRole('checkbox', { name: 'Tag them' }));

        await waitFor(() =>
            expect(mutations.onSaved).toHaveBeenCalledWith(saved),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/subtasks/subtask-2', method: 'patch' },
            { status: 'completed' },
        );
    });

    it('reopens a ticked sub-task', async () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage={false}
                canComplete
            />,
        );

        fireEvent.click(
            screen.getByRole('checkbox', { name: 'Find the flaky tests' }),
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                { url: '/subtasks/subtask-1', method: 'patch' },
                { status: 'open' },
            ),
        );
    });

    it('adds a sub-task with Enter and empties the field', async () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks(1)}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        const field = screen.getByLabelText('Add a sub-task');

        fireEvent.change(field, { target: { value: '  Tell the team ' } });
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() => expect((field as HTMLInputElement).value).toBe(''));
        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/items/item-1/subtasks', method: 'post' },
            { content: 'Tell the team' },
        );
    });

    it('keeps the text when the server refuses the sub-task', async () => {
        retroRequest.mockRejectedValue(new RetroRequestError(422, 'Too many.'));

        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks(1)}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        const field = screen.getByLabelText('Add a sub-task');

        fireEvent.change(field, { target: { value: 'Tell the team' } });
        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() => expect(retroRequest).toHaveBeenCalled());
        await waitFor(() =>
            expect(
                (
                    screen.getByRole('button', {
                        name: 'Add',
                    }) as HTMLButtonElement
                ).disabled,
            ).toBe(false),
        );
        expect((field as HTMLInputElement).value).toBe('Tell the team');
    });

    it('tells which sub-task each row button acts on', () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        for (const name of [
            'Move up',
            'Move down',
            'Edit sub-task',
            'Delete sub-task',
        ]) {
            expect(
                screen.getByRole('button', { name, description: 'Tag them' }),
            ).toBeTruthy();
        }
    });

    it('moves a sub-task up and down by its position', async () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        const up = screen.getAllByRole('button', { name: 'Move up' });
        const down = screen.getAllByRole('button', { name: 'Move down' });

        expect((up[0] as HTMLButtonElement).disabled).toBe(true);
        expect((down[2] as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(up[1]);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                { url: '/subtasks/subtask-2', method: 'patch' },
                { position: 0 },
            ),
        );

        fireEvent.click(down[1]);

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                { url: '/subtasks/subtask-2', method: 'patch' },
                { position: 2 },
            ),
        );
    });

    it('renames a sub-task; Escape leaves it as it was and stays out of the host overlay', async () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        fireEvent.click(
            screen.getAllByRole('button', { name: 'Edit sub-task' })[1],
        );

        const field = screen.getByRole('textbox', { name: 'Edit sub-task' });

        expect((field as HTMLInputElement).value).toBe('Tag them');

        const escape = createEvent.keyDown(field, { key: 'Escape' });

        fireEvent(field, escape);

        expect(escape.defaultPrevented).toBe(true);
        expect(
            screen.queryByRole('textbox', { name: 'Edit sub-task' }),
        ).toBeNull();
        expect(retroRequest).not.toHaveBeenCalled();

        fireEvent.click(
            screen.getAllByRole('button', { name: 'Edit sub-task' })[1],
        );
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Edit sub-task' }),
            { target: { value: 'Tag them as flaky' } },
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                { url: '/subtasks/subtask-2', method: 'patch' },
                { content: 'Tag them as flaky' },
            ),
        );
        await waitFor(() =>
            expect(
                screen.queryByRole('textbox', { name: 'Edit sub-task' }),
            ).toBeNull(),
        );
    });

    it('deletes a sub-task', async () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        fireEvent.click(
            screen.getAllByRole('button', { name: 'Delete sub-task' })[2],
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith({
                url: '/subtasks/subtask-3',
                method: 'delete',
            }),
        );
    });

    it('shows a reader the list only, with disabled checkboxes', () => {
        renderSubtasks(
            <ItemSubtasks
                item={withSubtasks()}
                endpoints={endpoints}
                canManage={false}
                canComplete={false}
            />,
        );

        expect(screen.queryByLabelText('Add a sub-task')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Edit sub-task' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete sub-task' }),
        ).toBeNull();
        expect(
            (
                screen.getByRole('checkbox', {
                    name: 'Tag them',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('renders nothing for a reader of an item without sub-tasks', () => {
        const { container } = render(
            <ActionItemMutationsContext value={actionItemMutationsFixture()}>
                <ItemSubtasks
                    item={actionItemFixture()}
                    endpoints={endpoints}
                    canManage={false}
                    canComplete
                />
            </ActionItemMutationsContext>,
        );

        expect(container.innerHTML).toBe('');
    });

    it('stops offering a new sub-task at twenty', () => {
        const item = actionItemFixture({
            subtasks: Array.from({ length: 20 }, (_, position) => ({
                id: `subtask-${position}`,
                content: `Step ${position}`,
                isCompleted: false,
                position,
            })),
        });

        renderSubtasks(
            <ItemSubtasks
                item={item}
                endpoints={endpoints}
                canManage
                canComplete
            />,
        );

        expect(screen.queryByLabelText('Add a sub-task')).toBeNull();
    });
});
