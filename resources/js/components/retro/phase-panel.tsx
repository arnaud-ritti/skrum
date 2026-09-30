import { useBoard } from './board-context';
import { HealthCheckPanel } from './health-check-panel';

export function PhasePanel() {
    const { board } = useBoard();

    switch (board.retro.phase) {
        case 'health_check':
            return <HealthCheckPanel />;
        default:
            return null;
    }
}
