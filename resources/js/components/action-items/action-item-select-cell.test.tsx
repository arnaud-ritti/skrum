import { renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    ActionItemSelectCell,
    ActionItemSelectGroup,
    ActionItemSelectHead,
} from '@/components/action-items/action-item-select-cell';
import { useActionItemSelection } from '@/components/action-items/use-action-item-selection';
import type { ActionItemSelection } from '@/components/action-items/use-action-item-selection';
import {
    actionItemFixture,
    actionItemViewerFixture,
} from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const mine = actionItemFixture({ id: 'a', content: 'Fix the build' });
const alsoMine = actionItemFixture({ id: 'b', content: 'Write the runbook' });
const others = actionItemFixture({
    id: 'c',
    content: 'Not mine',
    isMine: false,
    retroId: null,
});

function selectionFixture(
    overrides: Partial<ActionItemSelection> = {},
): ActionItemSelection {
    const { result } = renderHook(() =>
        useActionItemSelection({
            rows: [mine, alsoMine, others],
            viewer: actionItemViewerFixture(),
            total: 3,
            filtersKey: 'f',
            pageKey: 'p',
        }),
    );

    return {
        ...result.current,
        toggle: vi.fn(),
        setMany: vi.fn(),
        clear: vi.fn(),
        ...overrides,
    };
}

describe('ActionItemSelectCell', () => {
    it('toggles its row', async () => {
        const selection = selectionFixture();

        renderWithProviders(
            <ActionItemSelectCell item={mine} selection={selection} />,
        );
        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Select Fix the build' }),
        );

        expect(selection.toggle).toHaveBeenCalledWith('a');
    });

    it('reads ticked for a selected row', () => {
        renderWithProviders(
            <ActionItemSelectCell
                item={mine}
                selection={selectionFixture({ isSelected: () => true })}
            />,
        );

        expect(
            screen
                .getByRole('checkbox', { name: 'Select Fix the build' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('is disabled with a tooltip on a row the viewer cannot change', async () => {
        renderWithProviders(
            <ActionItemSelectCell
                item={others}
                selection={selectionFixture()}
            />,
        );

        expect(
            screen
                .getByRole('checkbox', { name: 'Select Not mine' })
                .hasAttribute('disabled'),
        ).toBe(true);

        await userEvent.tab();

        expect(
            await screen.findByRole('tooltip', {
                name: 'You cannot change this action item',
            }),
        ).toBeTruthy();
    });
});

describe('ActionItemSelectHead', () => {
    it('reads none, mixed and all, and selects the page', async () => {
        const items = [mine, alsoMine, others];
        const none = selectionFixture();
        const { rerender } = renderWithProviders(
            <ActionItemSelectHead items={items} selection={none} />,
        );

        const box = screen.getByRole('checkbox', {
            name: 'Select all on this page',
        });

        expect(box.getAttribute('aria-checked')).toBe('false');

        await userEvent.click(box);

        expect(none.setMany).toHaveBeenCalledWith(['a', 'b'], true);

        rerender(
            <ActionItemSelectHead
                items={items}
                selection={selectionFixture({ head: () => 'indeterminate' })}
            />,
        );

        expect(
            screen
                .getByRole('checkbox', { name: 'Select all on this page' })
                .getAttribute('aria-checked'),
        ).toBe('mixed');

        const all = selectionFixture({ head: () => true });

        rerender(<ActionItemSelectHead items={items} selection={all} />);
        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Clear selection' }),
        );

        expect(all.clear).toHaveBeenCalled();
    });
});

describe('ActionItemSelectGroup', () => {
    it('selects the selectable rows of its group', async () => {
        const selection = selectionFixture();

        renderWithProviders(
            <ActionItemSelectGroup
                label="Atlas"
                items={[mine, others]}
                selection={selection}
            />,
        );
        await userEvent.click(
            screen.getByRole('checkbox', { name: 'Select Atlas' }),
        );

        expect(selection.setMany).toHaveBeenCalledWith(['a'], true);
    });
});
