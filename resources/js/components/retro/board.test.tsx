import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '@/components/retro/board';
import { renderWithProviders } from '@/test/render';
import { boardContext, retroSnapshot } from '@/test/retro-board';

const state = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('@/hooks/use-retro-board', () => ({
    useRetroBoard: () => state.value,
}));

function given(
    overrides: Record<string, unknown> = {},
    snapshot = retroSnapshot(),
) {
    state.value = {
        ...boardContext(snapshot),
        status: 'active',
        connected: true,
        reconnecting: false,
        ...overrides,
    };

    return renderWithProviders(<Board snapshot={snapshot} />);
}

beforeEach(() => {
    state.value = {};
});

describe('Board', () => {
    it('renders the session shell: one realtime root, one main, the title, the phases, the people', () => {
        const { container } = given();

        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(
            container
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connected');
        expect(screen.getAllByRole('main')).toHaveLength(1);

        const header = container.querySelector('header') as HTMLElement;

        expect(header.querySelector('h1')?.textContent).toBe('Sprint 42');
        expect(header.querySelector('ol[aria-label="Phases"]')).not.toBeNull();
        expect(
            header.querySelector('[role="group"][aria-label="2 online"]'),
        ).not.toBeNull();
        expect(
            screen.getByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeTruthy();
    });

    it('is still connecting until the presence channel has answered', () => {
        const { container } = given({ online: [] });

        expect(
            container
                .querySelector('[data-realtime]')
                ?.getAttribute('data-realtime'),
        ).toBe('connecting');
    });

    it('makes the board inert under the expired banner', () => {
        const { container } = given({ sessionExpired: true });

        expect(screen.getByRole('alert').textContent).toContain(
            'Your session has expired.',
        );
        expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
        expect(
            container
                .querySelector('[data-slot="retro-body"]')
                ?.closest('[inert]'),
        ).not.toBeNull();
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
    });

    it('shows the reconnecting banner of a retro, which never speaks of cards kept locally', () => {
        given({ reconnecting: true });

        const banner = screen.getByRole('status', {
            name: (_name, element) =>
                element.getAttribute('data-variant') === 'banner',
        });

        expect(banner.textContent).toContain('Reconnecting…');
        expect(banner.textContent).toContain(
            'Live updates are paused. What you see may be out of date.',
        );
        expect(screen.queryByText(/kept locally/)).toBeNull();
    });

    it('keeps only the title once the board has ended for this viewer', () => {
        const { container } = given({ status: 'deleted' });

        expect(
            screen.getByText('This retrospective has been deleted.'),
        ).toBeTruthy();
        expect(container.querySelector('ol[aria-label="Phases"]')).toBeNull();
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('gives a participant no facilitator bar and no facilitator menu', () => {
        given(
            {},
            retroSnapshot({
                viewer: { isFacilitator: false, participantId: 'bob' },
            }),
        );

        expect(
            screen.queryByRole('toolbar', { name: 'Facilitation tools' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Facilitator menu' }),
        ).toBeNull();
    });
});
