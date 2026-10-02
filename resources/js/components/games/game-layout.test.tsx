import { fireEvent, screen, within } from '@testing-library/react';
import { Shapes, Users } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { createPortal } from 'react-dom';
import {
    GameLayout,
    useStageFooter,
    type GameLayoutPanel,
} from './game-layout';

function Docking() {
    const footer = useStageFooter();

    return footer === null ? (
        <p>in the flow</p>
    ) : (
        createPortal(<p>docked</p>, footer)
    );
}

function viewport(widestRem: number): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches:
                    Number(/min-width: (\d+)rem/.exec(query)?.[1]) <= widestRem,
                media: query,
                onchange: null,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
                addListener: () => undefined,
                removeListener: () => undefined,
                dispatchEvent: () => false,
            }) as MediaQueryList,
    );
}

const players: GameLayoutPanel = {
    id: 'players',
    label: 'Players',
    icon: Users,
    content: <p>the players</p>,
};
const guesses: GameLayoutPanel = {
    id: 'guesses',
    label: 'Guesses',
    icon: Users,
    content: <p>the guesses</p>,
};
const choice: GameLayoutPanel = {
    id: 'choice',
    label: 'Choose a game',
    icon: Shapes,
    content: <p>the games</p>,
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GameLayout', () => {
    it('holds the game choice in a column on a wide screen', () => {
        viewport(90);

        renderWithProviders(
            <GameLayout left={choice} right={players} stage={<p>stage</p>} />,
        );

        expect(
            within(
                screen.getByRole('complementary', { name: 'Choose a game' }),
            ).getByText('the games'),
        ).toBeTruthy();
        expect(
            within(
                screen.getByRole('complementary', { name: 'Players' }),
            ).getByText('the players'),
        ).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('opens the game choice from the foot of the players column, where players hold the left', () => {
        viewport(90);

        renderWithProviders(
            <GameLayout
                variant="players"
                left={players}
                right={guesses}
                chooser={choice}
                stage={<p>stage</p>}
                summary={<p>chips</p>}
                summaryFor="players"
            />,
        );

        expect(screen.queryByText('the games')).toBeNull();
        expect(screen.queryByText('chips')).toBeNull();
        expect(
            document.querySelector('[data-slot="game-layout"]')?.className,
        ).toContain('grid-cols-[18.75rem_minmax(0,1fr)_21.25rem]');

        const left = screen.getByRole('complementary', { name: 'Players' });

        fireEvent.click(
            within(left).getByRole('button', { name: 'Choose a game' }),
        );

        expect(
            within(screen.getByRole('dialog')).getByText('the games'),
        ).toBeTruthy();
    });

    it('moves the players to a sheet between the two widths, with the summary and a button for each sheet', () => {
        viewport(70);

        renderWithProviders(
            <GameLayout
                variant="players"
                left={players}
                right={guesses}
                chooser={choice}
                stage={<p>stage</p>}
                summary={<p>chips</p>}
                summaryFor="players"
            />,
        );

        expect(
            screen.queryByRole('complementary', { name: 'Players' }),
        ).toBeNull();
        expect(
            screen.getByRole('complementary', { name: 'Guesses' }),
        ).toBeTruthy();
        expect(screen.getByText('chips')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Guesses' })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Choose a game' }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Players' }));

        expect(
            within(screen.getByRole('dialog')).getByText('the players'),
        ).toBeTruthy();
    });

    it('keeps the summary away while the players stand in a column', () => {
        viewport(70);

        renderWithProviders(
            <GameLayout
                left={choice}
                right={players}
                stage={<p>stage</p>}
                summary={<p>chips</p>}
                summaryFor="players"
            />,
        );

        expect(screen.queryByText('chips')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Choose a game' }),
        ).toBeTruthy();
    });

    it('closes the sheet for good when its panel leaves, without opening it again when the panel comes back', () => {
        viewport(90);

        const withChooser = (
            <GameLayout
                variant="players"
                left={players}
                chooser={choice}
                stage={<p>stage</p>}
            />
        );
        const { rerender } = renderWithProviders(withChooser);

        fireEvent.click(screen.getByRole('button', { name: 'Choose a game' }));

        expect(screen.getByRole('dialog')).toBeTruthy();

        rerender(
            <GameLayout left={choice} right={players} stage={<p>stage</p>} />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(withChooser);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('gives a game a footer under the stage on a phone, and none on a wider screen', () => {
        viewport(24);

        const { unmount } = renderWithProviders(
            <GameLayout
                right={players}
                stage={<Docking />}
                dock={<p>bar</p>}
            />,
        );

        const footer = document.querySelector('[data-slot="game-footer"]');

        expect(footer?.textContent).toBe('docked');
        expect(screen.queryByText('in the flow')).toBeNull();
        expect(
            document
                .querySelector('[data-slot="game-dock"]')
                ?.compareDocumentPosition(footer as Element),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

        unmount();
        viewport(50);

        renderWithProviders(<GameLayout right={players} stage={<Docking />} />);

        expect(document.querySelector('[data-slot="game-footer"]')).toBeNull();
        expect(screen.getByText('in the flow')).toBeTruthy();
    });
});
