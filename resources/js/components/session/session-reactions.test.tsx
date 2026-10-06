import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionReactions } from '@/components/session/session-reactions';
import { readRecent } from '@/lib/emoji/recent';
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

const emojiData = { baseUrl: '/emoji', locale: 'en' };

function renderBar(
    presence = channel(),
    toolbarProps = {},
    extra: { emojiData?: typeof emojiData; compact?: boolean } = {},
) {
    renderWithProviders(
        <SessionReactions
            {...extra}
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
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) =>
                Response.json(
                    url.endsWith('messages.json')
                        ? {
                              groups: [
                                  {
                                      key: 'objects',
                                      message: 'objects',
                                      order: 0,
                                  },
                              ],
                              subgroups: [],
                              skinTones: [],
                          }
                        : [
                              {
                                  emoji: '🚀',
                                  label: 'rocket',
                                  group: 0,
                                  order: 1,
                                  version: 0.6,
                              },
                          ],
                ),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        localStorage.clear();
        sessionStorage.clear();
    });

    it('renders the Reactions toolbar with the six quick emoji and the picker trigger', () => {
        renderBar(channel(), {}, { emojiData });

        const toolbar = screen.getByRole('toolbar', { name: 'Reactions' });

        expect(
            toolbar.querySelectorAll('[aria-label^="Send a reaction "]'),
        ).toHaveLength(6);
        expect(
            within(toolbar).getByRole('button', { name: 'More emoji…' }),
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

    it('whispers the emoji picked in the picker, closes it and adds it to Recent', async () => {
        const presence = renderBar(channel(), {}, { emojiData });

        fireEvent.click(screen.getByRole('button', { name: 'More emoji…' }));
        fireEvent.click(
            await screen.findByRole('gridcell', { name: 'Rocket' }),
        );

        expect(presence.whisper).toHaveBeenCalledWith(
            'reaction',
            expect.objectContaining({ e: '🚀' }),
        );
        expect(readRecent()).toEqual(['🚀']);
        await waitFor(() => expect(screen.queryByRole('searchbox')).toBeNull());
    });

    it('adds a quick reaction of the bar to Recent', () => {
        renderBar();

        fireEvent.click(
            screen.getByRole('button', { name: 'Send a reaction 🤔' }),
        );

        expect(readRecent()).toEqual(['🤔']);
    });

    it('opens the picker from "More emoji…" when an emoji list exists', () => {
        renderBar(channel(), {}, { emojiData });

        fireEvent.click(screen.getByRole('button', { name: 'More emoji…' }));

        expect(
            screen.getByRole('searchbox', { name: 'Search an emoji…' }),
        ).toBeTruthy();
    });

    it('hides "More emoji…" without an emoji list', () => {
        renderBar();

        expect(
            screen.queryByRole('button', { name: 'More emoji…' }),
        ).toBeNull();
        expect(
            screen
                .getByRole('toolbar', { name: 'Reactions' })
                .querySelectorAll('button'),
        ).toHaveLength(6);
    });

    it('reaches the full emoji search from the drawer of the compact bar', () => {
        renderBar(channel(), {}, { emojiData, compact: true });

        fireEvent.click(screen.getByRole('button', { name: 'More reactions' }));
        fireEvent.click(screen.getByRole('button', { name: 'More emoji…' }));

        expect(
            screen.getByRole('dialog', { name: 'Send a reaction' }),
        ).toBeTruthy();
    });

    it('makes the picker trigger one stop of the toolbar arrow keys', () => {
        renderBar(channel(), {}, { emojiData });

        const trigger = screen.getByRole('button', { name: 'More emoji…' });
        const lastEmoji = screen.getByRole('button', {
            name: 'Send a reaction 👎',
        });

        expect(trigger.getAttribute('tabindex')).toBe('-1');
        expect(trigger.getAttribute('type')).toBe('button');

        lastEmoji.focus();
        fireEvent.keyDown(lastEmoji, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(trigger);
    });
});
