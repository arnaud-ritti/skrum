import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteboardSnapshot } from '@/lib/whiteboard/types';
import { renderWithProviders } from '@/test/render';
import ShowWhiteboard from './show';

const boardError = vi.hoisted(() => ({ current: new Error('') }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
            translations: {},
            locale: 'en',
            locales: ['en'],
            errors: {},
            brand: {
                name: 'Skrüm',
                logoLightUrl: null,
                logoDarkUrl: null,
                faviconUrl: null,
                poweredBy: true,
            },
        },
    }),
    Head: () => null,
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

vi.mock('@/components/whiteboard/board', () => ({
    default: () => {
        throw boardError.current;
    },
}));

const snapshot = {
    board: { title: 'Workshop' },
    links: { team: null },
} as unknown as WhiteboardSnapshot;

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('whiteboards/show page', () => {
    it('asks to check the connection when the canvas code fails to load', async () => {
        boardError.current = new TypeError(
            'Failed to fetch dynamically imported module: /build/assets/board.js',
        );

        renderWithProviders(<ShowWhiteboard snapshot={snapshot} />);

        expect(
            await screen.findByText('The canvas could not be loaded.'),
        ).toBeTruthy();
        expect(
            screen.getByText('Check your connection, then try again.'),
        ).toBeTruthy();
    });

    it('does not blame the connection when the canvas itself crashes', async () => {
        boardError.current = new Error('Cannot read properties of undefined');

        renderWithProviders(<ShowWhiteboard snapshot={snapshot} />);

        expect(
            await screen.findByText('Something went wrong. Please try again.'),
        ).toBeTruthy();
        expect(
            screen.queryByText('Check your connection, then try again.'),
        ).toBeNull();
    });
});
