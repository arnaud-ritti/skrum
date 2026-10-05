import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { HintButton } from './hint-button';
import { RoomProvider, type RoomContextValue } from './room-context';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({
        props: {
            translations: {
                'Reveal a letter (:count left)':
                    'Révéler une lettre (:count restantes)',
                'Reveal a letter (1 left)': 'Révéler une lettre (1 restante)',
            },
        },
    }),
}));

describe('HintButton', () => {
    it('says the last hint left in the singular', () => {
        const ctx = {
            snapshot: { room: { id: 'room' } },
            run: vi.fn(),
            dispatch: vi.fn(),
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <HintButton
                    round={
                        {
                            id: 'round',
                            maxHints: 2,
                            mask: ['B', null],
                        } as GameRound
                    }
                />
            </RoomProvider>,
        );

        expect(
            screen.getByRole('button', {
                name: 'Révéler une lettre (1 restante)',
            }),
        ).toBeTruthy();
    });
});
