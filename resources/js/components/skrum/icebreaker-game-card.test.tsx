import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    IcebreakerGameCard,
    IcebreakerGameGrid,
} from '@/components/skrum/icebreaker-game-card';

const base = {
    game: 'hangman' as const,
    title: 'Hangman',
    pitch: 'Guess the word.',
    color: 'sun' as const,
    durationMin: 5,
    players: { min: 3, max: 12 },
    participants: 5,
};

describe('IcebreakerGameCard', () => {
    it('shows duration and player range and checks when selected', () => {
        const { rerender } = render(<IcebreakerGameCard {...base} />);

        expect(
            screen.getByText(':count min'.replace(':count', '5')),
        ).toBeTruthy();
        expect(screen.getByText('3-12')).toBeTruthy();
        expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe(
            'false',
        );
        expect(
            document.querySelector('[data-slot="icebreaker-game-check"]'),
        ).toBeNull();

        rerender(<IcebreakerGameCard {...base} selected />);

        expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe(
            'true',
        );
        expect(
            document.querySelector('[data-slot="icebreaker-game-check"]'),
        ).not.toBeNull();
    });

    it('calls onSelect with the game on click', () => {
        const onSelect = vi.fn();
        render(<IcebreakerGameCard {...base} onSelect={onSelect} />);

        fireEvent.click(screen.getByRole('radio'));

        expect(onSelect).toHaveBeenCalledWith('hangman');
    });

    it('is unavailable with a readable reason when too few players', () => {
        const onSelect = vi.fn();
        render(
            <IcebreakerGameCard
                {...base}
                participants={2}
                onSelect={onSelect}
            />,
        );
        const radio = screen.getByRole('radio');

        fireEvent.click(radio);

        expect(onSelect).not.toHaveBeenCalled();
        expect(radio.getAttribute('aria-disabled')).toBe('true');
        const reasonId =
            radio.getAttribute('aria-describedby')?.split(' ').pop() ?? '';
        expect(document.getElementById(reasonId)?.textContent).toBe(
            'min. 3 players'.replace('3', '3'),
        );
    });

    it('is unavailable above the maximum', () => {
        render(<IcebreakerGameCard {...base} participants={13} />);

        expect(screen.getByRole('radio').getAttribute('aria-disabled')).toBe(
            'true',
        );
        expect(
            screen.getByText('max. :count players'.replace(':count', '12')),
        ).toBeTruthy();
    });

    it('is available with no aria-disabled when the count fits', () => {
        render(<IcebreakerGameCard {...base} participants={3} />);

        expect(
            screen.getByRole('radio').getAttribute('aria-disabled'),
        ).toBeNull();
    });

    it('labels the emoji art of the decoded game', () => {
        render(<IcebreakerGameCard {...base} game="decoded" />);

        expect(
            document.querySelector('[role="img"][aria-label]'),
        ).not.toBeNull();
    });
});

describe('IcebreakerGameGrid', () => {
    it('moves focus with arrows, wrapping, and selects with space', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <IcebreakerGameGrid>
                <IcebreakerGameCard {...base} title="One" onSelect={onSelect} />
                <IcebreakerGameCard
                    {...base}
                    game="draw"
                    title="Two"
                    onSelect={onSelect}
                />
            </IcebreakerGameGrid>,
        );
        const [one, two] = screen.getAllByRole('radio');

        expect(screen.getByRole('radiogroup')).toBeTruthy();
        expect(one.tabIndex).toBe(0);
        expect(two.tabIndex).toBe(-1);

        one.focus();
        await user.keyboard('{ArrowRight}');
        expect(document.activeElement).toBe(two);

        await user.keyboard('{ArrowRight}');
        expect(document.activeElement).toBe(one);

        await user.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(two);

        await user.keyboard(' ');
        expect(onSelect).toHaveBeenCalledWith('draw');
    });
});
