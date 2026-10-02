import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeckCard } from '@/components/poker/deck-card';
import type { DeckCardModel } from '@/components/poker/deck-card';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    };
});

const fibonacci: DeckCardModel = {
    id: 'fibonacci',
    name: 'Fibonacci',
    cards: ['0', '1', '2', '3', '5', '8', '13', '?', '☕'],
    kind: 'builtin',
    isDefault: true,
    usageCount: 31,
};

const hours: DeckCardModel = {
    id: 'deck-1',
    name: 'Hours (spikes)',
    cards: ['1 h', '2 h', '4 h', '?'],
    kind: 'team',
    isDefault: false,
    usageCount: 1,
    createdBy: 'Malik K',
};

describe('DeckCard', () => {
    it('shows a built-in deck locked, with its values, its usage and the Default badge', () => {
        renderWithProviders(
            <DeckCard deck={fibonacci} onDuplicate={vi.fn()} />,
        );

        const card = screen.getByRole('article', { name: 'Fibonacci' });

        expect(within(card).getByText('9 values · 31 games')).toBeTruthy();
        expect(within(card).getByText('Default')).toBeTruthy();
        expect(within(card).getByText('Built-in')).toBeTruthy();
        expect(
            within(within(card).getByRole('list', { name: 'Values' }))
                .getAllByRole('listitem')
                .map((value) => value.textContent),
        ).toEqual(['0', '1', '2', '3', '5', '8', '13', '?', '☕']);
        expect(
            within(card).getByRole('button', { name: 'Duplicate Fibonacci' }),
        ).toBeTruthy();
        expect(
            within(card).queryByRole('button', { name: /^Edit/ }),
        ).toBeNull();
        expect(
            within(card).queryByRole('button', { name: /^Delete/ }),
        ).toBeNull();
    });

    it('shows a custom deck with its author and a singular usage', () => {
        renderWithProviders(<DeckCard deck={hours} />);

        const card = screen.getByRole('article', { name: 'Hours (spikes)' });

        expect(
            within(card).getByText('Custom · by Malik K · 1 game'),
        ).toBeTruthy();
        expect(within(card).queryByText('Built-in')).toBeNull();
        expect(within(card).queryByText('Default')).toBeNull();
        expect(within(card).queryByRole('button')).toBeNull();
    });

    it('leaves the author out when the deck has none', () => {
        renderWithProviders(
            <DeckCard deck={{ ...hours, createdBy: null, usageCount: 0 }} />,
        );

        expect(screen.getByText('Custom · 0 games')).toBeTruthy();
    });

    it('marks a workspace deck', () => {
        renderWithProviders(
            <DeckCard deck={{ ...hours, kind: 'workspace' }} />,
        );

        expect(screen.getByText('Workspace')).toBeTruthy();
    });

    it('calls each action of a managed deck by its name', () => {
        const onEdit = vi.fn();
        const onDuplicate = vi.fn();
        const onDelete = vi.fn();
        const onSetDefault = vi.fn();

        renderWithProviders(
            <DeckCard
                deck={hours}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onSetDefault={onSetDefault}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Hours (spikes)' }),
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Duplicate Hours (spikes)' }),
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Hours (spikes)' }),
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Set Hours (spikes) as default',
            }),
        );

        expect(onEdit).toHaveBeenCalledOnce();
        expect(onDuplicate).toHaveBeenCalledOnce();
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onSetDefault).toHaveBeenCalledOnce();
    });

    it('does not offer "Set as default" on the default deck', () => {
        renderWithProviders(
            <DeckCard deck={fibonacci} onSetDefault={vi.fn()} />,
        );

        expect(
            screen.queryByRole('button', { name: /as default$/ }),
        ).toBeNull();
    });

    it('makes its actions wait while a request about the deck runs', () => {
        renderWithProviders(
            <DeckCard
                deck={hours}
                busy
                onEdit={vi.fn()}
                onDuplicate={vi.fn()}
                onDelete={vi.fn()}
                onSetDefault={vi.fn()}
            />,
        );

        for (const button of screen.getAllByRole('button')) {
            expect((button as HTMLButtonElement).disabled).toBe(true);
        }
    });
});
