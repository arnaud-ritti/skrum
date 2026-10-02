import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionReactions } from '@/components/session/session-reactions';
import { renderWithProviders } from '@/test/render';

type Listener = (data: unknown, metadata?: { user_id?: string }) => void;

function channel() {
    const listeners = new Map<string, Listener>();

    return {
        whisper: vi.fn(),
        listen: vi.fn((event: string, callback: Listener) =>
            listeners.set(event, callback),
        ),
        stopListening: vi.fn(),
        receive: (senderId: string, data: unknown) =>
            listeners.get('.client-reaction')?.(data, { user_id: senderId }),
    };
}

const online = [
    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'bob', name: 'Bob Stone', avatarUrl: '/b.svg', isGuest: false },
];

function renderBar(presence = channel(), toolbarProps = {}) {
    renderWithProviders(
        <SessionReactions
            presence={presence}
            selfId="me"
            online={online}
            labelFor={(id) =>
                online.find((member) => member.id === id)?.name ?? null
            }
            originFor={() => 0.5}
            toolbarProps={toolbarProps}
        />,
    );

    return presence;
}

describe('SessionReactions', () => {
    it('renders the Reactions toolbar with the six quick emoji and the picker trigger', () => {
        renderBar();

        const toolbar = screen.getByRole('toolbar', { name: 'Reactions' });

        expect(
            toolbar.querySelectorAll('[aria-label^="Send a reaction "]'),
        ).toHaveLength(6);
        expect(
            screen.getByRole('button', { name: 'Send a reaction' }),
        ).toBeTruthy();
    });

    it('puts the toolbar props on the toolbar element', () => {
        renderBar(channel(), { className: 'whiteboard-reactions' });

        expect(
            screen
                .getByRole('toolbar', { name: 'Reactions' })
                .classList.contains('whiteboard-reactions'),
        ).toBe(true);
    });

    it('whispers the emoji that is pressed', () => {
        const presence = renderBar();

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction 🎉' }),
        );

        expect(presence.whisper).toHaveBeenCalledWith(
            'reaction',
            expect.objectContaining({ e: '🎉' }),
        );
    });

    it('flies a reaction of someone in the room in the library overlay, with the name', () => {
        const presence = renderBar();

        act(() => {
            presence.receive('bob', { v: 1, t: 'r', e: '👏' });
        });

        const overlay = document.querySelector('.lr-overlay');

        expect(overlay?.textContent).toContain('👏');
        expect(overlay?.textContent).toContain('Bob Stone');
        expect(document.querySelector('[data-slot="reaction-fly"]')).toBeNull();
    });

    it('drops a reaction from someone who is not in the room, and a text that is not one emoji', () => {
        const presence = renderBar();

        act(() => {
            presence.receive('stranger', { v: 1, t: 'r', e: '👏' });
            presence.receive('bob', { v: 1, t: 'r', e: 'hello' });
        });

        expect(
            document.querySelector('.lr-overlay')?.textContent ?? '',
        ).not.toContain('👏');
        expect(
            document.querySelector('.lr-overlay')?.textContent ?? '',
        ).not.toContain('hello');
    });
});
