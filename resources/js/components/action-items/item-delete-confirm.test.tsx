import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemDeleteConfirm } from '@/components/action-items/item-delete-confirm';
import { actionItemFixture } from '@/test/action-items';

describe('ItemDeleteConfirm', () => {
    it('is closed while no item is to be deleted', () => {
        render(
            <ItemDeleteConfirm
                item={null}
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('asks before deleting, naming the item', () => {
        render(
            <ItemDeleteConfirm
                item={actionItemFixture()}
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Delete this action item?',
        });

        expect(dialog.textContent).toContain(
            '“Quarantine the flaky tests” is removed for everyone, with its sub-tasks and comments.',
        );
        expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    });

    it('deletes the item on confirmation, then closes', async () => {
        const item = actionItemFixture();
        const onConfirm = vi.fn(async () => {});
        const onCancel = vi.fn();

        render(
            <ItemDeleteConfirm
                item={item}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(item));
        await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    });

    it('deletes nothing on Cancel', () => {
        const onConfirm = vi.fn();
        const onCancel = vi.fn();

        render(
            <ItemDeleteConfirm
                item={actionItemFixture()}
                onCancel={onCancel}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
