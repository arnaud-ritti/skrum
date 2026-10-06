import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { retroRequest } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';
import { BoardShare, GuestAccessSwitchId } from './board-share';
import { boardState } from '@/test/whiteboard-state';

vi.mock('@/lib/retro/api', async (original) => ({
    ...(await original<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(async () => null),
}));

afterEach(() => {
    vi.mocked(retroRequest).mockClear();
});

function openShare() {
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));

    return within(screen.getByRole('dialog'));
}

describe('BoardShare', () => {
    it('gives the facilitator the link, "Allow guests without an account" and "Regenerate link"', () => {
        renderWithProviders(<BoardShare state={boardState()} />);

        const dialog = openShare();
        const link = dialog.getByRole('textbox', { name: 'Guest link' });

        expect((link as HTMLInputElement).value).toBe(
            'https://skrum.test/whiteboards/join/token-1',
        );
        expect(dialog.getByRole('button', { name: 'Copy' })).toBeTruthy();
        expect(
            dialog.getByRole('button', { name: 'Regenerate link' }),
        ).toBeTruthy();
        expect(
            document
                .getElementById(GuestAccessSwitchId)
                ?.getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('shows the session code and where to enter it', () => {
        renderWithProviders(
            <BoardShare
                state={boardState({ board: { joinCode: 'K7Q-P4M2' } })}
            />,
        );

        const dialog = openShare();

        expect(dialog.getByText('K7Q-P4M2')).toBeTruthy();
        expect(
            dialog.getByText(`Join at ${window.location.host}/join`),
        ).toBeTruthy();
    });

    it('shows no session code without one', () => {
        renderWithProviders(<BoardShare state={boardState()} />);

        expect(openShare().queryByText('Session code')).toBeNull();
    });

    it('closes guest access through the settings endpoint and refetches', async () => {
        const state = boardState();

        renderWithProviders(<BoardShare state={state} />);
        openShare();
        fireEvent.click(document.getElementById(GuestAccessSwitchId)!);

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            guest_access_enabled: false,
        });
    });

    it('asks before it closes guest access while a guest is on the board', async () => {
        const guest = {
            id: 'member-gia',
            name: 'Guest Gia',
            avatarUrl: '/avatars/g.svg',
            isGuest: true,
        };
        const state = boardState({ online: [guest] });

        renderWithProviders(<BoardShare state={state} />);
        openShare();
        fireEvent.click(document.getElementById(GuestAccessSwitchId)!);

        expect(retroRequest).not.toHaveBeenCalled();

        const confirmation = within(screen.getByRole('alertdialog'));

        expect(
            confirmation.getByText('Guests on this board lose access.'),
        ).toBeTruthy();

        fireEvent.click(
            confirmation.getByRole('button', { name: 'Turn off guest access' }),
        );

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(vi.mocked(retroRequest).mock.calls[0][1]).toEqual({
            guest_access_enabled: false,
        });
    });

    it('asks before it replaces the link, then posts and refetches', async () => {
        const state = boardState();

        renderWithProviders(<BoardShare state={state} />);

        const dialog = openShare();

        fireEvent.click(
            dialog.getByRole('button', { name: 'Regenerate link' }),
        );

        expect(retroRequest).not.toHaveBeenCalled();

        const confirmation = within(screen.getByRole('alertdialog'));

        fireEvent.click(
            confirmation.getByRole('button', { name: 'Regenerate' }),
        );

        await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));

        expect(retroRequest).toHaveBeenCalledTimes(1);
    });

    it('lets a member copy the link and shows no guest control', () => {
        renderWithProviders(
            <BoardShare state={boardState({ me: { isFacilitator: false } })} />,
        );

        const dialog = openShare();

        expect(dialog.getByRole('button', { name: 'Copy' })).toBeTruthy();
        expect(document.getElementById(GuestAccessSwitchId)).toBeNull();
        expect(
            dialog.queryByRole('button', { name: 'Regenerate link' }),
        ).toBeNull();
    });

    it('shows no link while guest access is off', () => {
        renderWithProviders(
            <BoardShare
                state={boardState({ board: { guestAccessEnabled: false } })}
            />,
        );

        const dialog = openShare();

        expect(
            dialog.queryByRole('textbox', { name: 'Guest link' }),
        ).toBeNull();
        expect(
            dialog.queryByRole('button', { name: 'Regenerate link' }),
        ).toBeNull();
        expect(dialog.getByText('Guest link is off')).toBeTruthy();
    });
});
