import { act, render } from '@testing-library/react';
import { cursorColor, moveMessage } from 'live-cursors';
import { describe, expect, it } from 'vitest';
import { LiveCursors } from '@/components/session/live-cursors';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

type Listener = (data: unknown, metadata?: { user_id?: string }) => void;

function fakeChannel() {
    const listeners = new Map<string, Listener>();
    const channel: WhisperChannel = {
        whisper: () => undefined,
        listen: (event, callback) => {
            listeners.set(event, callback);

            return channel;
        },
        stopListening: (event) => {
            listeners.delete(event);

            return channel;
        },
    };

    return {
        channel,
        move: (senderId: string) => {
            act(() => {
                listeners.get('.client-cursor')?.(
                    moveMessage(senderId, 0.5, 0.5),
                    { user_id: senderId },
                );
            });
        },
    };
}

const online: PresenceMember[] = [
    { id: 'me', name: 'Me', avatarUrl: '', isGuest: false, presence: 1 },
    { id: 'ada', name: 'Ada', avatarUrl: '', isGuest: false, presence: 5 },
    { id: 'lin', name: 'Lin', avatarUrl: '', isGuest: true },
];

function renderCursors(presenceFor: (senderId: string) => number | undefined) {
    const container = document.createElement('div');
    const { channel, move } = fakeChannel();

    document.body.append(container);

    const view = render(
        <LiveCursors
            presence={channel}
            container={container}
            hidden={false}
            selfId="me"
            online={online}
            labelFor={(senderId) => senderId}
            presenceFor={presenceFor}
        />,
    );

    return { ...view, move };
}

function cursorTint(root: HTMLElement): string | undefined {
    return (
        root
            .querySelector<HTMLElement>('.lc-cursor')
            ?.style.getPropertyValue('--lc-color') ?? undefined
    );
}

describe('LiveCursors', () => {
    it("paints a cursor in its sender's presence colour", () => {
        const { container, move } = renderCursors(
            (senderId) =>
                online.find((member) => member.id === senderId)?.presence,
        );

        move('ada');

        expect(cursorTint(container)).toBe('var(--skrum-presence-5)');
        expect(container.textContent).toContain('ada');
    });

    it('keeps the library colour for a sender without one', () => {
        const { container, move } = renderCursors(
            (senderId) =>
                online.find((member) => member.id === senderId)?.presence,
        );

        move('lin');

        expect(cursorTint(container)).toBe(cursorColor('lin'));
    });
});
