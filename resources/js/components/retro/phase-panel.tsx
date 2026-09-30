import { useBoard } from './board-context';
import { IcebreakerPanel } from './icebreaker-panel';

export function PhasePanel() {
    const { board } = useBoard();

    switch (board.retro.phase) {
        case 'icebreaker':
            return <IcebreakerPanel />;
        default:
            return null;
    }
}
