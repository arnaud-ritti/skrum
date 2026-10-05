import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InviteLinkBlock } from '@/components/invitations/invite-link-block';
import type { InviteLink } from '@/lib/invitations/types';

const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('sonner', () => ({ toast }));

const Day = 24 * 60 * 60 * 1000;

function link(overrides: Partial<InviteLink> = {}): InviteLink {
    return {
        url: 'https://skrum.test/invite/abc',
        expiresAt: new Date(Date.now() + 7 * Day - 60_000).toISOString(),
        usesCount: 0,
        ...overrides,
    };
}

function renderBlock(
    props: Partial<Parameters<typeof InviteLinkBlock>[0]> = {},
) {
    const handlers = {
        onCreate: vi.fn(),
        onReplace: vi.fn().mockResolvedValue(undefined),
        onTurnOff: vi.fn().mockResolvedValue(undefined),
    };

    render(
        <InviteLinkBlock link={link()} canManage {...handlers} {...props} />,
    );

    return handlers;
}

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    toast.error.mockReset();
    vi.restoreAllMocks();
});

describe('InviteLinkBlock', () => {
    it('shows the link and when it expires, without a use limit', () => {
        renderBlock();

        expect(screen.getByText('skrum.test/invite/abc')).toBeTruthy();
        expect(screen.getByText('Expires in 7 days')).toBeTruthy();
        expect(screen.queryByText(/joined/)).toBeNull();
        expect(screen.queryByText(/up to/)).toBeNull();
    });

    it('counts the people who joined', () => {
        renderBlock({ link: link({ usesCount: 3 }) });

        expect(screen.getByText('Expires in 7 days · 3 joined')).toBeTruthy();
    });

    it('copies the URL and says so for two seconds', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        renderBlock();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        });

        expect(writeText).toHaveBeenCalledWith('https://skrum.test/invite/abc');
        expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });

    it('asks before creating a new link', async () => {
        const { onReplace } = renderBlock();

        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );

        expect(onReplace).not.toHaveBeenCalled();

        const dialog = screen.getByRole('alertdialog');

        expect(
            within(dialog).getByText('The current link stops working.'),
        ).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', {
                    name: 'Create a new link',
                }),
            );
        });

        expect(onReplace).toHaveBeenCalledTimes(1);
    });

    it('asks before turning the link off', async () => {
        const { onTurnOff } = renderBlock();

        fireEvent.click(
            screen.getByRole('button', { name: 'Turn off the link' }),
        );

        expect(onTurnOff).not.toHaveBeenCalled();

        const dialog = screen.getByRole('alertdialog');

        expect(
            within(dialog).getByText(
                'People with the link can no longer join.',
            ),
        ).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', {
                    name: 'Turn off the link',
                }),
            );
        });

        expect(onTurnOff).toHaveBeenCalledTimes(1);
    });

    it('keeps the reason of a refused new link in the dialog', async () => {
        renderBlock({
            onReplace: vi
                .fn()
                .mockRejectedValue(new Error('Only owners can do this.')),
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );

        const dialog = screen.getByRole('alertdialog');

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', {
                    name: 'Create a new link',
                }),
            );
        });

        expect(within(dialog).getByRole('alert').textContent).toBe(
            'Only owners can do this.',
        );
    });

    it('says so when the browser refuses the copy', async () => {
        vi.stubGlobal('navigator', {
            clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) },
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        renderBlock();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
        });

        expect(toast.error).toHaveBeenCalledWith(
            'Something went wrong. Please try again.',
        );
        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
    });

    it('says an expired link has expired', () => {
        renderBlock({
            link: link({
                expiresAt: new Date(Date.now() - Day).toISOString(),
            }),
        });

        expect(screen.getByText('Link expired')).toBeTruthy();
    });

    it('counts one person who joined in the singular', () => {
        renderBlock({ link: link({ usesCount: 1 }) });

        expect(screen.getByText('Expires in 7 days · 1 joined')).toBeTruthy();
    });

    it('shows nothing when there is no link and no way to create one', () => {
        renderBlock({ link: null, canManage: false });

        expect(screen.queryByText('Or share this link')).toBeNull();
    });

    it('offers to create a link when there is none', () => {
        const { onCreate } = renderBlock({ link: null });

        fireEvent.click(screen.getByRole('button', { name: 'Create a link' }));

        expect(onCreate).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    });

    it('shows the link without its management to who may not manage it', () => {
        renderBlock({ canManage: false });

        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Create a new link' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Turn off the link' }),
        ).toBeNull();
    });
});
