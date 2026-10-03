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
    it('shows the icon of the game alone when compact', () => {
        const { container, rerender } = render(
            <IcebreakerGameCard game="decoded" title="Decoded" />,
        );

        expect(screen.queryByRole('img', { hidden: true })).toBeTruthy();
        expect(container.querySelectorAll('svg')).toHaveLength(1);

        rerender(<IcebreakerGameCard game="decoded" title="Decoded" compact />);

        expect(screen.queryByRole('img', { hidden: true })).toBeNull();
        expect(container.querySelectorAll('svg')).toHaveLength(1);
        expect(screen.getByRole('radio').getAttribute('data-compact')).toBe(
            'true',
        );
    });

    it('renders a server option with only its kind and label', () => {
        const onSelect = vi.fn();
        render(
            <IcebreakerGameCard
                game="draw"
                title="Draw & Guess"
                available
                onSelect={onSelect}
            />,
        );

        const radio = screen.getByRole('radio', { name: 'Draw & Guess' });

        expect(radio.getAttribute('aria-disabled')).toBeNull();
        expect(radio.getAttribute('aria-describedby')).toBeNull();
        expect(screen.queryByText(/min$/)).toBeNull();
        expect(screen.queryByText(/players/)).toBeNull();

        fireEvent.click(radio);

        expect(onSelect).toHaveBeenCalledWith('draw');
    });

    it('is not selectable when the server refuses the game, whatever the participants', () => {
        const onSelect = vi.fn();
        const { rerender } = render(
            <IcebreakerGameCard
                {...base}
                game="gif"
                available={false}
                onSelect={onSelect}
            />,
        );

        const radio = screen.getByRole('radio');

        expect(radio.getAttribute('aria-disabled')).toBe('true');
        expect(screen.getByText('Not available')).toBeTruthy();

        fireEvent.click(radio);

        expect(onSelect).not.toHaveBeenCalled();

        rerender(
            <IcebreakerGameCard
                {...base}
                game="gif"
                available={false}
                unavailableReason="No GIF provider configured"
                onSelect={onSelect}
            />,
        );

        expect(
            screen.getByRole('radio').getAttribute('aria-describedby'),
        ).toContain(screen.getByText('No GIF provider configured').id);
    });

    it('keeps the participant check when the server allows the game', () => {
        render(<IcebreakerGameCard {...base} available participants={2} />);

        expect(screen.getByRole('radio').getAttribute('aria-disabled')).toBe(
            'true',
        );
    });

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

    it('says "In play" on the selected card of a room, in place of the check', () => {
        const { rerender } = render(<IcebreakerGameCard {...base} inPlay />);

        expect(screen.queryByText('In play')).toBeNull();

        rerender(<IcebreakerGameCard {...base} selected inPlay />);

        const radio = screen.getByRole('radio');

        expect(
            document.querySelector('[data-slot="icebreaker-game-check"]'),
        ).toBeNull();
        expect(radio.getAttribute('aria-describedby')).toContain(
            screen.getByText('In play').id,
        );
    });

    it('calls onSelect with the game on click', () => {
        const onSelect = vi.fn();
        render(<IcebreakerGameCard {...base} onSelect={onSelect} />);

        fireEvent.click(screen.getByRole('radio'));

        expect(onSelect).toHaveBeenCalledWith('hangman');
    });

    it('takes no click when read-only, and keeps its full colour', () => {
        const onSelect = vi.fn();
        render(
            <IcebreakerGameCard
                {...base}
                selected
                readOnly
                onSelect={onSelect}
            />,
        );
        const radio = screen.getByRole('radio');

        fireEvent.click(radio);

        expect(onSelect).not.toHaveBeenCalled();
        expect(radio.getAttribute('aria-disabled')).toBe('true');
        expect(radio.getAttribute('aria-checked')).toBe('true');
        expect(radio.getAttribute('data-unavailable')).toBe('false');
        expect(radio.className).not.toContain('opacity-55');
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

describe('IcebreakerGameCard, the eight games', () => {
    const games = [
        ['hangman', 'Hangman', 'lucide-whole-word', 'coral'],
        ['draw', 'Draw & Guess', 'lucide-brush', 'iris'],
        ['gif', 'Sprint in one GIF', 'lucide-film', 'apricot'],
        ['decoded', 'Decoded', 'lucide-smile', 'sun'],
        ['two_truths', 'Two truths and a lie', 'lucide-venetian-mask', 'plum'],
        ['mood', 'Mood weather', 'lucide-cloud-sun', 'sky'],
        ['guess_who', 'Guess who?', 'lucide-user-round-search', 'moss'],
        [
            'quick_question',
            'Quick question',
            'lucide-message-circle-question',
            'lagoon',
        ],
    ] as const;

    it.each(games)(
        'renders %s with its name, its icon and its colour',
        (game, title, icon, color) => {
            const { container } = render(
                <IcebreakerGameCard game={game} title={title} compact />,
            );
            const radio = screen.getByRole('radio', { name: title });

            expect(radio.getAttribute('data-game')).toBe(game);
            expect(container.querySelector(`svg.${icon}`)).not.toBeNull();
            expect(
                container.querySelector(`.bg-skrum-col-${color}`),
            ).not.toBeNull();
        },
    );

    it.each(games)(
        'draws the art of %s with its corner icon',
        (game, title, icon) => {
            const { container } = render(
                <IcebreakerGameCard game={game} title={title} />,
            );

            expect(container.querySelector(`svg.${icon}`)).not.toBeNull();
            expect(
                container.querySelector('[aria-hidden] > :first-child'),
            ).not.toBeNull();
        },
    );

    it('marks the lie among the three cards of Two truths', () => {
        const { container } = render(
            <IcebreakerGameCard
                game="two_truths"
                title="Two truths and a lie"
            />,
        );

        expect(container.querySelectorAll('.rotate-6')).toHaveLength(1);
        expect(screen.getByText('L', { selector: '.rotate-6' })).toBeTruthy();
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
