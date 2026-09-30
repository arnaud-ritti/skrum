import { useBoard } from './board-context';
import { HealthCheckPanel } from './health-check-panel';
import { IcebreakerPanel } from './icebreaker-panel';

export function PhasePanel() {
    const { board } = useBoard();

    switch (board.retro.phase) {
        case 'health_check':
            return <HealthCheckPanel />;
        case 'icebreaker':
            return <IcebreakerPanel />;
        default:
            return null;
    }
}
