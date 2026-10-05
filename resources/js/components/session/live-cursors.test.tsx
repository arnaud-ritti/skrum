import { act, render } from '@testing-library/react';
import { cursorColor, moveMessage } from 'live-cursors';
import { describe, expect, it, vi } from 'vitest';
import { LiveCursors } from '@/components/session/live-cursors';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import type { PresenceMember } from '@/lib/retro/types';

type Listener = (data: unknown, metadata?: { user_id?: string }) => void;

function fakeChannel() {
    const listeners = new Map<string, Listener>();
    const whisper = vi.fn();
    const channel: WhisperChannel = {
        whisper,
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
        whisper,
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

function renderCursors(
    presenceFor: (senderId: string) => number | undefined = () => undefined,
) {
    const container = document.createElement('div');
    const { channel, move, whisper } = fakeChannel();

    Object.defineProperty(container, 'scrollWidth', { value: 100 });
    Object.defineProperty(container, 'scrollHeight', { value: 100 });
    document.body.append(container);

    const cursors = (members: PresenceMember[], hidden = false) => (
        <LiveCursors
            presence={channel}
            container={container}
            hidden={hidden}
            selfId="me"
            online={members}
            labelFor={(senderId) => senderId}
            presenceFor={presenceFor}
        />
    );
    const view = render(cursors(online));

    return {
        ...view,
        space: container,
        move,
        whisper,
        update: (members: PresenceMember[], hidden = false) =>
            view.rerender(cursors(members, hidden)),
    };
}

function press(
    target: HTMLElement,
    type: 'pointerdown' | 'pointerup',
    pointerType = 'touch',
) {
    const event = new MouseEvent(type, {
        bubbles: true,
        clientX: 50,
        clientY: 50,
    });

    Object.defineProperty(event, 'pointerType', { value: pointerType });
    act(() => {
        target.dispatchEvent(event);
    });
}

const sent = (whisper: ReturnType<typeof vi.fn>) =>
    whisper.mock.calls.map(([, message]) => (message as { t: string }).t);

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

    it('draws no cursor for a sender who is not in the room', () => {
        const { container, move } = renderCursors();

        move('stranger');

        expect(container.querySelector('.lc-cursor')).toBeNull();
    });

    it('takes away the cursor of someone who leaves the room', () => {
        const { container, move, update } = renderCursors();

        move('ada');

        expect(container.querySelector('.lc-cursor')).not.toBeNull();

        update(online.filter((member) => member.id !== 'ada'));

        expect(container.querySelector('.lc-cursor')).toBeNull();
    });

    it('shares a finger while it is down, and says it left when it is lifted', () => {
        const { space, whisper } = renderCursors();

        press(space, 'pointerdown');
        press(space, 'pointerup');

        expect(sent(whisper)).toEqual(['m', 'l']);
        expect(whisper.mock.calls[0][1]).toMatchObject({
            id: 'me',
            m: { p: 'touch' },
        });
    });

    it('says the finger left when the cursor is hidden while it is down', () => {
        const { space, whisper, update } = renderCursors();

        press(space, 'pointerdown');
        update(online, true);

        expect(sent(whisper).at(-1)).toBe('l');
    });
});
