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

    it('clears the name with null when the title is emptied', () => {
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

        expect(onRename).toHaveBeenCalledTimes(1);
        expect(onRename).toHaveBeenCalledWith(null);
    });

    it('does not rename an unnamed group left empty, nor save its fallback title', () => {
        const onRename = vi.fn();

        const { container } = renderWithProviders(
            group({ title: '', canEdit: true, onRename }),
        );

        fireEvent.click(
            container.querySelector(
                '[data-slot="card-group-title"]',
            ) as HTMLElement,
        );

        const input = screen.getByRole('textbox', {
            name: 'Group title',
        }) as HTMLInputElement;

        expect(input.value).toBe('');

        fireEvent.keyDown(input, { key: 'Enter' });

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

    it('never uses the text of a masked card in the title or the labels', () => {
        const secret = 'A secret nobody may read';
        const { container } = renderWithProviders(
            group({
                title: '',
                canEdit: true,
                onUngroup: vi.fn(),
                cards: [
                    { id: '1', text: secret, color: 'coral', masked: true },
                    { id: '2', text: 'Huge pull requests', color: 'coral' },
                ],
            }),
        );

        expect(
            screen.getByRole('region', {
                name: 'Group: Untitled group, 2 cards',
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'Remove from group: Card hidden until the reveal',
            }),
        ).toBeTruthy();
        expect(container.innerHTML).not.toContain(secret);
    });

    it('keeps a masked card out of the collapsed list for assistive tech', () => {
        const secret = 'A secret nobody may read';
        const { container } = renderWithProviders(
            group({
                collapsed: true,
                cards: [
                    { id: '1', text: 'Reviews come too late', color: 'coral' },
                    { id: '2', text: secret, color: 'coral', masked: true },
                ],
            }),
        );

        expect(container.innerHTML).not.toContain(secret);
        expect(
            container.querySelector('[data-slot="card-group-hidden-cards"]')
                ?.textContent,
        ).toBe('Card hidden until the reveal');
    });

    it('names a GIF card without text in the fallback title', () => {
        renderWithProviders(
            group({
                title: '',
                cards: [
                    {
                        id: '1',
                        text: null,
                        gif: { previewUrl: '/p.gif', url: '/f.gif' },
                        color: 'coral',
                    },
                ],
            }),
        );

        expect(
            screen.getByRole('region', { name: 'Group: GIF, 1 cards' }),
        ).toBeTruthy();
    });

    it('puts the ungroup button beside the footer controls of the card, not over them', () => {
        const onUngroup = vi.fn();
        const onVote = vi.fn();
        const onDelete = vi.fn();

        renderWithProviders(
            group({
                canEdit: true,
                onUngroup,
                cards: [
                    {
                        id: '1',
                        text: 'Reviews come too late',
                        color: 'coral',
                        votes: { total: 2, mine: 0 },
                        canVote: true,
                        canEdit: true,
                        onVote,
                        onDelete,
                    },
                ],
            }),
        );
        const ungroup = screen.getByRole('button', {
            name: 'Remove from group: Reviews come too late',
        });
        const footer = ungroup.closest('[data-slot="retro-card-footer"]');

        expect(footer).not.toBeNull();
        expect(ungroup.className).not.toContain('absolute');
        expect(
            footer?.contains(
                screen.getByRole('button', { name: 'Vote, 2 votes' }),
            ),
        ).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Vote, 2 votes' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete card' }));

        expect(onVote).toHaveBeenCalledWith(1);
        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onUngroup).not.toHaveBeenCalled();

        fireEvent.click(ungroup);

        expect(onUngroup).toHaveBeenCalledWith('1');
    });

    it('returns focus to the title after a rename is committed or cancelled', () => {
        renderWithProviders(group({ canEdit: true, onRename: vi.fn() }));

        fireEvent.click(screen.getByText('Code review quality'));
        const input = screen.getByRole('textbox', { name: 'Group title' });

        expect(document.activeElement).toBe(input);

        fireEvent.change(input, { target: { value: 'Reviews' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Code review quality' }),
        );

        fireEvent.click(screen.getByText('Code review quality'));
        fireEvent.keyDown(
            screen.getByRole('textbox', { name: 'Group title' }),
            { key: 'Escape' },
        );

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Code review quality' }),
        );
    });

    it('limits the title to the length the server accepts', () => {
        renderWithProviders(group({ canEdit: true, editingTitle: true }));

        expect(
            screen
                .getByRole('textbox', { name: 'Group title' })
                .getAttribute('maxlength'),
        ).toBe('60');
    });

    it('forwards rest props to the section', () => {
        renderWithProviders(
            group({ 'data-test': 'card-group-g1' } as Partial<CardGroupProps>),
        );

        expect(screen.getByRole('region').getAttribute('data-test')).toBe(
            'card-group-g1',
        );
    });

    describe('extreme data', () => {
        const thirty = Array.from({ length: 30 }, (_, index) => ({
            id: `c${index}`,
            text: `Card number ${index + 1}`,
            color: 'red' as const,
            author: { id: `u${index % 14}`, name: `Person ${index % 14}` },
        }));

        it('renders a group of 30 cards', () => {
            renderWithProviders(
                group({ cards: thirty, canEdit: true, onUngroup: vi.fn() }),
            );

            expect(
                screen.getByRole('region', {
                    name: 'Group: Code review quality, 30 cards',
                }),
            ).toBeTruthy();
            expect(screen.getAllByRole('article')).toHaveLength(30);
            expect(
                screen.getAllByRole('button', { name: /Remove from group/ }),
            ).toHaveLength(30);
        });

        it('collapses a group of 30 cards to one card, three avatars and a count', () => {
            const { container } = renderWithProviders(
                group({ cards: thirty, collapsed: true }),
            );
            const footer = container.querySelector(
                '[data-slot="card-group-footer"]',
            );

            expect(screen.getAllByRole('article')).toHaveLength(1);
            expect(
                footer?.querySelectorAll('[data-slot="person-avatar"]'),
            ).toHaveLength(3);
            expect(footer?.textContent).toContain('+ 29 cards');
        });

        it('truncates a 280-character first card in the fallback title', () => {
            const text = 'word '.repeat(56);

            renderWithProviders(
                group({ title: '', cards: [{ id: '1', text, color: 'red' }] }),
            );

            expect(text).toHaveLength(280);
            expect(
                document.querySelector('[data-slot="card-group-title"]')
                    ?.textContent,
            ).toBe('word word word word word word word word…');
        });
    });
});
