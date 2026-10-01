import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardGroup } from '@/components/skrum/card-group';
import type { CardGroupProps } from '@/components/skrum/card-group';
import { renderWithProviders } from '@/test/render';

const cards = [
    { id: '1', text: 'Reviews come too late', color: 'coral' as const },
    { id: '2', text: 'Huge pull requests', color: 'coral' as const },
    { id: '3', text: 'Nobody is assigned', color: 'coral' as const },
];

function group(props: Partial<CardGroupProps> = {}) {
    return (
        <CardGroup
            id="g1"
            title="Code review quality"
            color="coral"
            cards={cards}
            {...props}
        />
    );
}

describe('CardGroup', () => {
    it('labels the section with title and card count', () => {
        renderWithProviders(group());

        expect(
            screen.getByRole('region', {
                name: 'Group: Code review quality, 3 cards',
            }),
        ).toBeTruthy();
    });

    it('falls back to the truncated first card text when the title is empty', () => {
        renderWithProviders(group({ title: '' }));

        expect(
            screen.getByRole('region', {
                name: 'Group: Reviews come too late, 3 cards',
            }),
        ).toBeTruthy();
    });

    it('toggles collapsed state and reports it', () => {
        const onToggle = vi.fn();

        renderWithProviders(group({ onToggle }));

        const toggle = screen.getByRole('button', { name: 'Collapse group' });

        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(toggle);

        expect(onToggle).toHaveBeenCalledWith(true);
        expect(
            screen
                .getByRole('button', { name: 'Expand group' })
                .getAttribute('aria-expanded'),
        ).toBe('false');
    });

    it('shows only the first card when collapsed and keeps hidden ones readable', () => {
        const { container } = renderWithProviders(group({ collapsed: true }));

        expect(screen.getAllByRole('article')).toHaveLength(1);
        expect(screen.getByText('Huge pull requests')).toBeTruthy();
        expect(
            container.querySelectorAll('[data-slot="card-group-slice"]'),
        ).toHaveLength(2);
        container
            .querySelectorAll('[data-slot="card-group-slice"]')
            .forEach((slice) =>
                expect(slice.getAttribute('aria-hidden')).toBe('true'),
            );
    });

    it('renames on Enter and cancels on Escape', () => {
        const onRename = vi.fn();

        renderWithProviders(group({ canEdit: true, onRename }));

        fireEvent.click(screen.getByText('Code review quality'));
        fireEvent.change(screen.getByRole('textbox', { name: 'Group title' }), {
            target: { value: 'Reviews' },
        });
        fireEvent.keyDown(
            screen.getByRole('textbox', { name: 'Group title' }),
            {
                key: 'Enter',
            },
        );

        expect(onRename).toHaveBeenCalledWith('Reviews');
        expect(
            screen.queryByRole('textbox', { name: 'Group title' }),
        ).toBeNull();

        fireEvent.click(screen.getByText('Code review quality'));
        fireEvent.change(screen.getByRole('textbox', { name: 'Group title' }), {
            target: { value: 'Other' },
        });
        fireEvent.keyDown(
            screen.getByRole('textbox', { name: 'Group title' }),
            {
                key: 'Escape',
            },
        );

        expect(onRename).toHaveBeenCalledTimes(1);
        expect(
            screen.queryByRole('textbox', { name: 'Group title' }),
        ).toBeNull();
    });

    it('does not rename an empty title', () => {
        const onRename = vi.fn();

        renderWithProviders(group({ canEdit: true, onRename }));

        fireEvent.click(screen.getByText('Code review quality'));
        fireEvent.change(screen.getByRole('textbox', { name: 'Group title' }), {
            target: { value: '   ' },
        });
        fireEvent.keyDown(
            screen.getByRole('textbox', { name: 'Group title' }),
            {
                key: 'Enter',
            },
        );

        expect(onRename).not.toHaveBeenCalled();
    });

    it('does not offer title editing without canEdit', () => {
        renderWithProviders(group());

        fireEvent.click(screen.getByText('Code review quality'));

        expect(
            screen.queryByRole('textbox', { name: 'Group title' }),
        ).toBeNull();
    });

    it('opens in edit mode when editingTitle is set', () => {
        renderWithProviders(group({ canEdit: true, editingTitle: true }));

        expect(
            screen.getByRole('textbox', { name: 'Group title' }),
        ).toBeTruthy();
    });

    it('ungroups a card', () => {
        const onUngroup = vi.fn();

        renderWithProviders(group({ canEdit: true, onUngroup }));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Remove from group: Huge pull requests',
            }),
        );

        expect(onUngroup).toHaveBeenCalledWith('2');
    });

    it('shows the vote total, hidden when null', () => {
        const { rerender } = renderWithProviders(
            group({ votes: { total: 11, mine: 2 } }),
        );

        expect(screen.getByText(/11 votes in total/)).toBeTruthy();

        rerender(group({ votes: { total: null, mine: 0 } }));

        expect(screen.queryByText(/votes in total/)).toBeNull();
    });
});
