import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    HealthCheckButton,
    HealthCheckMenuItem,
    showsHealthCheck,
} from '@/components/retro/health-check-button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { HealthCheckState } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

function healthCheck(state: Partial<HealthCheckState> = {}): HealthCheckState {
    return {
        surveyId: 'survey-1',
        isClosed: false,
        scale: 5,
        respondents: 3,
        participants: 8,
        hasSubmitted: false,
        statements: [],
        results: null,
        ...state,
    };
}

describe('showsHealthCheck', () => {
    it('is true while a health check is attached to an open retro', () => {
        expect(showsHealthCheck(retroSnapshot())).toBe(false);
        expect(
            showsHealthCheck(retroSnapshot({ healthCheck: healthCheck() })),
        ).toBe(true);
        expect(
            showsHealthCheck(
                retroSnapshot({
                    healthCheck: healthCheck({ isClosed: true }),
                    retro: { phase: 'actions' },
                }),
            ),
        ).toBe(true);
        expect(
            showsHealthCheck(
                retroSnapshot({
                    healthCheck: healthCheck(),
                    retro: { phase: 'completed' },
                }),
            ),
        ).toBe(false);
    });
});

describe('HealthCheckButton', () => {
    it('says how many sent their answers out of how many joined, and opens the health check', async () => {
        const onOpen = vi.fn();
        const { container } = renderInBoard(
            <HealthCheckButton onOpen={onOpen} />,
            boardContext(
                retroSnapshot({
                    healthCheck: healthCheck({ hasSubmitted: true }),
                }),
            ),
        );

        const button = screen.getByRole('button', {
            name: 'Health check, 3 of 8 answered',
        });

        expect(button.textContent).toContain('Health check');
        expect(
            container.querySelector('[data-slot="health-check-count"]')
                ?.textContent,
        ).toBe('3/8');

        await userEvent.click(button);

        expect(onOpen).toHaveBeenCalledTimes(1);
    });

    it('marks it while the viewer has not sent their answers to an open health check', () => {
        const dot = (state: Partial<HealthCheckState>) => {
            const { container, unmount } = renderInBoard(
                <HealthCheckButton onOpen={vi.fn()} />,
                boardContext(
                    retroSnapshot({ healthCheck: healthCheck(state) }),
                ),
            );
            const found =
                container.querySelector('[data-slot="health-check-todo"]') !==
                null;

            unmount();

            return found;
        };

        expect(dot({})).toBe(true);
        expect(dot({ hasSubmitted: true })).toBe(false);
        expect(dot({ isClosed: true })).toBe(false);
    });

    it('tells a screen reader that the viewer has not sent their answers', () => {
        renderInBoard(
            <HealthCheckButton onOpen={vi.fn()} />,
            boardContext(retroSnapshot({ healthCheck: healthCheck() })),
        );

        expect(
            screen.getByRole('button', {
                name: 'Health check, 3 of 8 answered, your answers not sent',
            }),
        ).toBeTruthy();
    });

    it('renders nothing without a health check', () => {
        const { container } = renderInBoard(
            <HealthCheckButton onOpen={vi.fn()} />,
            boardContext(),
        );

        expect(container.textContent).toBe('');
    });
});

describe('HealthCheckMenuItem', () => {
    it('is the same entry in the one menu of a phone', async () => {
        const onSelect = vi.fn();

        renderInBoard(
            <DropdownMenu>
                <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <HealthCheckMenuItem onSelect={onSelect} />
                </DropdownMenuContent>
            </DropdownMenu>,
            boardContext(retroSnapshot({ healthCheck: healthCheck() })),
        );

        await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
        await userEvent.click(
            screen.getByRole('menuitem', {
                name: 'Health check, 3 of 8 answered, your answers not sent',
            }),
        );

        expect(onSelect).toHaveBeenCalledTimes(1);
    });
});
