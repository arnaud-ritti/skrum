import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    ShareDialog,
    ShareDialogContent,
} from '@/components/skrum/share-dialog';
import type {
    ShareDialogProps,
    ShareMember,
} from '@/components/skrum/share-dialog';
import { renderWithProviders } from '@/test/render';

const url = 'https://skrum.test/j/ATL-4821-k7Qp';

function baseProps(
    overrides: Partial<ShareDialogProps> = {},
): ShareDialogProps {
    return {
        open: true,
        onOpenChange: vi.fn(),
        session: {
            id: 's1',
            kind: 'retro',
            title: 'Sprint 42 retro',
            teamName: 'Atlas',
            presentCount: 4,
        },
        invite: {
            url,
            allowGuests: true,
            status: 'active',
            code: 'ATL-4821',
            joinUrl: 'skrum.test/join',
            defaultRole: 'participant',
            expiry: '24h',
            expiresAt: null,
        },
        canManage: true,
        onCopy: vi.fn(),
        onChange: vi.fn(),
        onRegenerate: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

const members: ShareMember[] = [
    { id: 'a', name: 'Alice Martin', email: 'alice@x.io', inSession: false },
    { id: 'b', name: 'Bob Stone', email: 'bob@x.io', inSession: true },
    { id: 'c', name: 'Carla Diaz', email: 'carla@x.io', inSession: false },
];

describe('ShareDialog', () => {
    it('counts one person present with the singular key', () => {
        const props = baseProps();

        renderWithProviders(
            <ShareDialog
                {...props}
                session={{ ...props.session, presentCount: 1 }}
            />,
        );

        const dialog = screen.getByRole('dialog');

        expect(dialog.textContent).toContain('Atlas · 1 present');
        expect(dialog.textContent).not.toContain(':count');
    });

    it('shows the link, the code and the QR and focuses the copy button', async () => {
        renderWithProviders(<ShareDialog {...baseProps()} />);

        expect(
            screen.getByRole('dialog', { name: /Sprint 42 retro/ }),
        ).toBeTruthy();
        expect(
            (screen.getByLabelText('Guest link') as HTMLInputElement).value,
        ).toBe(url);
        expect(screen.getByText('ATL-4821')).toBeTruthy();
        expect(screen.getByRole('img', { name: /QR code/ })).toBeTruthy();
        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Copy link' }),
            ),
        );
    });

    it('copies the link, shows the copied state, then reverts', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const onCopy = vi.fn();

        renderWithProviders(<ShareDialog {...baseProps({ onCopy })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

        expect(onCopy).toHaveBeenCalledWith('url');
        await screen.findByRole('button', { name: 'Copied' });
        await vi.advanceTimersByTimeAsync(2100);
        await screen.findByRole('button', { name: 'Copy link' });
        vi.useRealTimers();
    });

    it('does not show the copied state when the copy fails', async () => {
        const onCopy = vi.fn().mockResolvedValue(false);

        renderWithProviders(<ShareDialog {...baseProps({ onCopy })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

        await waitFor(() => expect(onCopy).toHaveBeenCalled());
        expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    });

    it('says where the code is entered, as the mockup words it', () => {
        renderWithProviders(<ShareDialog {...baseProps()} />);

        expect(screen.getByText('Join at skrum.test/join')).toBeTruthy();
    });

    it('copies the code', () => {
        const onCopy = vi.fn();

        renderWithProviders(<ShareDialog {...baseProps({ onCopy })} />);
        fireEvent.click(screen.getByRole('button', { name: 'Copy the code' }));

        expect(onCopy).toHaveBeenCalledWith('code');
    });

    it('calls onDownloadQr from the download button', () => {
        const onDownloadQr = vi.fn();

        renderWithProviders(<ShareDialog {...baseProps({ onDownloadQr })} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Download the QR code' }),
        );

        expect(onDownloadQr).toHaveBeenCalledOnce();
    });

    it('toggles guest access through onChange', () => {
        const onChange = vi.fn();

        renderWithProviders(<ShareDialog {...baseProps({ onChange })} />);
        fireEvent.click(screen.getByRole('switch', { name: 'Allow guests' }));

        expect(onChange).toHaveBeenCalledWith({ allowGuests: false });
    });

    it('gives the guest switch the id a page asks for', () => {
        renderWithProviders(
            <ShareDialog
                {...baseProps({ guestSwitchId: 'poker-guest-link-access' })}
            />,
        );

        expect(
            screen
                .getByRole('switch', { name: 'Allow guests' })
                .getAttribute('id'),
        ).toBe('poker-guest-link-access');
    });

    it('asks for confirmation before regenerating, focusing Cancel first', async () => {
        const onRegenerate = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(<ShareDialog {...baseProps({ onRegenerate })} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );

        const confirm = await screen.findByRole('alertdialog');

        expect(onRegenerate).not.toHaveBeenCalled();
        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Cancel' }),
            ),
        );

        const buttons = confirm.querySelectorAll('button');

        fireEvent.click(buttons[buttons.length - 1]);

        await waitFor(() => expect(onRegenerate).toHaveBeenCalledOnce());
    });

    it('does not regenerate when the confirmation is cancelled', async () => {
        const onRegenerate = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(<ShareDialog {...baseProps({ onRegenerate })} />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );
        await screen.findByRole('alertdialog');
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        expect(onRegenerate).not.toHaveBeenCalled();
    });

    it('shows the expired state with copy and download disabled', () => {
        const onRegenerate = vi.fn().mockResolvedValue(undefined);

        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    onRegenerate,
                    invite: {
                        ...baseProps().invite,
                        status: 'expired',
                        expiresAt: '2026-09-01T10:00:00Z',
                    },
                })}
            />,
        );

        expect(screen.getByText('This link has expired')).toBeTruthy();
        expect(screen.getByText('Expired')).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Copy link',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Download the QR code',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );

        expect(onRegenerate).toHaveBeenCalledOnce();
    });

    it('hides the link and the QR when guest access is off', () => {
        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    invite: { url: null, allowGuests: false },
                })}
            />,
        );

        expect(screen.queryByLabelText('Guest link')).toBeNull();
        expect(screen.queryByRole('img', { name: /QR code/ })).toBeNull();
        expect(screen.getByText('Sign-in required to join.')).toBeTruthy();
    });

    it('is read-only for a participant', () => {
        renderWithProviders(
            <ShareDialog {...baseProps({ canManage: false })} />,
        );

        expect(screen.getByLabelText('Guest link')).toBeTruthy();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Create a new link' }),
        ).toBeNull();
    });

    it('does not render features the back end lacks when props are absent', () => {
        renderWithProviders(
            <ShareDialog
                {...baseProps({ invite: { url, allowGuests: true } })}
            />,
        );

        expect(screen.queryByText('ATL-4821')).toBeNull();
        expect(screen.queryByText('Default role')).toBeNull();
        expect(screen.queryByText('Link expiry')).toBeNull();
        expect(screen.queryByRole('tab')).toBeNull();
    });

    it('posts to a connected channel with the guest link option', async () => {
        const onShareToChannel = vi.fn().mockResolvedValue(true);

        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    channels: ['slack', 'msteams'],
                    onShareToChannel,
                })}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Post link to Slack' }),
        );
        await waitFor(() =>
            expect(onShareToChannel).toHaveBeenCalledWith('slack', false),
        );

        fireEvent.click(screen.getByLabelText('Include the guest link'));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Post link to Microsoft Teams',
            }),
        );
        await waitFor(() =>
            expect(onShareToChannel).toHaveBeenCalledWith('msteams', true),
        );
    });

    it('lets someone who may post but not manage the link post to a channel, and tells them nothing false about the guest link', () => {
        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    canManage: false,
                    invite: { url: null, allowGuests: true },
                    channels: ['slack'],
                    onShareToChannel: vi.fn().mockResolvedValue(true),
                })}
            />,
        );

        expect(
            screen.getByRole('button', { name: 'Post link to Slack' }),
        ).toBeTruthy();
        expect(screen.queryByText('Guest link is off')).toBeNull();
        expect(screen.queryByLabelText('Include the guest link')).toBeNull();
        expect(screen.queryByRole('switch')).toBeNull();
    });

    it('keeps the delivery lines when no channel is left to post to', () => {
        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    channels: [],
                    onShareToChannel: vi.fn().mockResolvedValue(true),
                    channelsExtra: <p>Slack: failed</p>,
                })}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Post a link' }),
        ).toBeTruthy();
        expect(screen.getByText('Slack: failed')).toBeTruthy();
        expect(screen.queryByLabelText('Include the guest link')).toBeNull();
    });

    it('shows no channels block without a channel and without an extra block', () => {
        renderWithProviders(
            <ShareDialog
                {...baseProps({ channels: [], onShareToChannel: vi.fn() })}
            />,
        );

        expect(
            screen.queryByRole('heading', { name: 'Post a link' }),
        ).toBeNull();
    });

    it('renders the mobile drawer with share action', () => {
        const onShare = vi.fn();

        renderWithProviders(
            <ShareDialog {...baseProps({ isMobile: true, onShare })} />,
        );

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.queryByText('Default role')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Share…' }));

        expect(onShare).toHaveBeenCalledOnce();
    });

    it('reflects a regenerated link on rerender without closing', () => {
        const props = baseProps();
        const { rerender } = renderWithProviders(<ShareDialog {...props} />);

        rerender(
            <ShareDialog
                {...props}
                invite={{
                    ...props.invite,
                    url: 'https://skrum.test/j/new',
                    code: 'ATL-9999',
                }}
            />,
        );

        expect(
            (screen.getByLabelText('Guest link') as HTMLInputElement).value,
        ).toBe('https://skrum.test/j/new');
        expect(screen.getByText('ATL-9999')).toBeTruthy();
    });

    it('returns focus to the opener on close', async () => {
        function Host() {
            const [open, setOpen] = useState(false);

            return (
                <>
                    <button onClick={() => setOpen(true)}>Invite</button>
                    <ShareDialog
                        {...baseProps({ open, onOpenChange: setOpen })}
                    />
                </>
            );
        }

        const user = userEvent.setup();

        renderWithProviders(<Host />);

        const opener = screen.getByRole('button', { name: 'Invite' });

        await user.click(opener);
        await screen.findByRole('dialog');
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

        expect(document.activeElement).toBe(opener);
    });

    it('survives a 60-character title and a 200-member list', () => {
        const longTitle = 'T'.repeat(60);
        const many: ShareMember[] = Array.from({ length: 200 }, (_, index) => ({
            id: `m${index}`,
            name: `Member ${index}`,
            email: `m${index}@x.io`,
            inSession: false,
        }));

        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    session: { id: 's', kind: 'poker', title: longTitle },
                    members: many,
                    onInvite: vi.fn().mockResolvedValue(undefined),
                    tab: 'members',
                })}
            />,
        );

        expect(screen.getByRole('dialog')).toBeTruthy();
        fireEvent.focus(
            screen.getByRole('combobox', { name: 'Add team members' }),
        );

        expect(screen.getAllByRole('option')).toHaveLength(200);
    });
});

describe('ShareDialogContent', () => {
    it('renders the body inline, without a dialog around it', () => {
        const {
            open: _open,
            onOpenChange: _change,
            ...content
        } = baseProps({
            members,
            onInvite: vi.fn().mockResolvedValue(undefined),
        });

        renderWithProviders(<ShareDialogContent {...content} />);

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(
            (screen.getByLabelText('Guest link') as HTMLInputElement).value,
        ).toBe(url);
        expect(screen.getByRole('tab', { name: /Members/ })).toBeTruthy();
    });
});

describe('ShareDialog members tab', () => {
    function renderMembers(onInvite = vi.fn().mockResolvedValue(undefined)) {
        renderWithProviders(
            <ShareDialog
                {...baseProps({ members, onInvite, tab: 'members' })}
            />,
        );

        return onInvite;
    }

    it('shows the count of invitable members on the tab', () => {
        renderMembers();

        expect(
            screen.getByRole('tab', { name: /Members/ }).textContent,
        ).toContain('2');
    });

    it('marks members already in the session as disabled', () => {
        renderMembers();

        fireEvent.focus(
            screen.getByRole('combobox', { name: 'Add team members' }),
        );

        const option = screen.getByRole('option', { name: /Bob Stone/ });

        expect(option.getAttribute('aria-disabled')).toBe('true');
        fireEvent.click(option);
        expect(
            screen.queryAllByRole('button', { name: /Remove/ }),
        ).toHaveLength(0);
    });

    it('adds with Enter, removes with Backspace and sends the invitations', async () => {
        const user = userEvent.setup();
        const onInvite = renderMembers();
        const input = screen.getByRole('combobox', {
            name: 'Add team members',
        });

        await user.click(input);
        await user.keyboard('{Enter}');

        expect(
            screen.getByRole('button', { name: 'Remove Alice Martin' }),
        ).toBeTruthy();

        await user.keyboard('{ArrowDown}{Enter}');
        expect(
            screen.getByRole('button', { name: 'Send 2 invitations' }),
        ).toBeTruthy();

        await user.keyboard('{Backspace}');
        expect(
            screen.queryByRole('button', { name: 'Remove Carla Diaz' }),
        ).toBeNull();

        await user.click(
            screen.getByRole('button', { name: 'Send 1 invitation' }),
        );

        await waitFor(() =>
            expect(onInvite).toHaveBeenCalledWith(['a'], 'participant'),
        );
    });

    it('disables the send button at zero and filters by typing', async () => {
        const user = userEvent.setup();

        renderMembers();

        const send = screen.getByRole('button', {
            name: 'Send 0 invitations',
        });

        expect(send.getAttribute('aria-disabled')).toBe('true');

        await user.type(
            screen.getByRole('combobox', { name: 'Add team members' }),
            'carl',
        );

        expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('does not invite anyone from the send button at zero', async () => {
        const user = userEvent.setup();
        const onInvite = renderMembers();

        await user.click(
            screen.getByRole('button', { name: 'Send 0 invitations' }),
        );

        expect(onInvite).not.toHaveBeenCalled();
    });

    it('keeps focus on the send button once the invitations are sent', async () => {
        const user = userEvent.setup();
        const onInvite = renderMembers();

        await user.click(
            screen.getByRole('combobox', { name: 'Add team members' }),
        );
        await user.keyboard('{Enter}');

        const send = screen.getByRole('button', { name: 'Send 1 invitation' });

        await user.click(send);

        await waitFor(() => expect(onInvite).toHaveBeenCalledTimes(1));
        await screen.findByRole('button', { name: 'Send 0 invitations' });
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Send 0 invitations' }),
        );
        expect(document.activeElement).not.toBe(document.body);
    });

    it('closes the listbox, not the dialog, on the first Escape', async () => {
        const user = userEvent.setup();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <ShareDialog
                {...baseProps({
                    members,
                    onInvite: vi.fn().mockResolvedValue(undefined),
                    tab: 'members',
                    onOpenChange,
                })}
            />,
        );

        const input = screen.getByRole('combobox', {
            name: 'Add team members',
        });

        await user.click(input);
        expect(input.getAttribute('aria-expanded')).toBe('true');

        await user.keyboard('{Escape}');

        expect(input.getAttribute('aria-expanded')).toBe('false');
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(input);

        await user.keyboard('{Escape}');

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('scrolls the active option into view while moving through 200 members', async () => {
        const user = userEvent.setup();
        const scrolled: string[] = [];
        const original = Object.getOwnPropertyDescriptor(
            Element.prototype,
            'scrollIntoView',
        );

        Object.defineProperty(Element.prototype, 'scrollIntoView', {
            configurable: true,
            writable: true,
            value(this: Element) {
                scrolled.push(this.id);
            },
        });

        try {
            const many: ShareMember[] = Array.from(
                { length: 200 },
                (_, index) => ({
                    id: `m${index}`,
                    name: `Member ${index}`,
                    email: `m${index}@x.io`,
                    inSession: false,
                }),
            );

            renderWithProviders(
                <ShareDialog
                    {...baseProps({
                        members: many,
                        onInvite: vi.fn().mockResolvedValue(undefined),
                        tab: 'members',
                    })}
                />,
            );

            const input = screen.getByRole('combobox', {
                name: 'Add team members',
            });

            await user.click(input);
            await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

            const active = input.getAttribute('aria-activedescendant');

            expect(active).toBe(screen.getAllByRole('option')[3].id);
            expect(scrolled.at(-1)).toBe(active);
            expect(new Set(scrolled).size).toBe(4);
        } finally {
            if (original) {
                Object.defineProperty(
                    Element.prototype,
                    'scrollIntoView',
                    original,
                );
            } else {
                Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
            }
        }
    });
});
