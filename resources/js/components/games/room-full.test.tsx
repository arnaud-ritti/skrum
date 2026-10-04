import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomFull } from './room-full';

describe('RoomFull', () => {
    it('says how many players the room takes, as the server caps it', () => {
        renderWithProviders(<RoomFull maxPlayers={12} />);

        expect(
            screen.getByText('Up to 12 players can be online at once.'),
        ).toBeTruthy();
    });
});
