import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardShare, showsBoardShare } from '@/components/retro/board-share';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

const slack = {
    slack: true,
    telegram: false,
    msteams: false,
    mattermost: false,
    webhook: false,
    email: false,
};

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ id: 'delivery-1' });
});

describe('showsBoardShare', () => {
    it('is always offered to the facilitator, who manages the guest link there', () => {
        expect(showsBoardShare(retroSnapshot())).toBe(true);
        expect(
            showsBoardShare(retroSnapshot({ retro: { phase: 'completed' } })),
        ).toBe(true);
    });

    it('is offered to someone who may post the link while the retro is open', () => {
        const manager = { isFacilitator: false };

        expect(showsBoardShare(retroSnapshot({ viewer: manager }))).toBe(false);
        expect(
            showsBoardShare(
                retroSnapshot({ viewer: manager, integrations: slack }),
            ),
        ).toBe(true);
        expect(
            showsBoardShare(
                retroSnapshot({
                    viewer: manager,
                    integrations: slack,
                    retro: { phase: 'completed' },
                }),
            ),
        ).toBe(false);
    });
});

describe('BoardShare', () => {
    it('holds the guest link, its switch and the QR code', () => {
        renderInBoard(
            <BoardShare open onOpenChange={vi.fn()} />,
            boardContext(),
        );

        expect(
            (screen.getByLabelText('Guest link') as HTMLInputElement).value,
        ).toBe('https://skrum.test/join/token');
        expect(
            screen.getByRole('switch', { name: 'Allow guests' }),
        ).toBeTruthy();
        expect(screen.getByRole('img', { name: /QR code/ })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Download the QR code' }),
        ).toBeTruthy();
    });

    it('turns guest access off through the settings endpoint', async () => {
        const { ctx } = renderInBoard(
            <BoardShare open onOpenChange={vi.fn()} />,
            boardContext(),
        );

        fireEvent.click(screen.getByRole('switch', { name: 'Allow guests' }));

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/settings'),
            }),
            { guest_access_enabled: false },
        );
    });

    it('creates a new link only after a confirmation', async () => {
        const { ctx } = renderInBoard(
            <BoardShare open onOpenChange={vi.fn()} />,
            boardContext(),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );

        expect(retroRequest).not.toHaveBeenCalled();

        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Create a new link',
            }),
        );

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                url: expect.stringContaining('/retros/retro-1/guest-token'),
            }),
        );
    });

    it('posts the link to a channel with the guest link option and lists the deliveries', async () => {
        renderInBoard(
            <BoardShare open onOpenChange={vi.fn()} />,
            boardContext(
                retroSnapshot({
                    integrations: slack,
                    linkDeliveries: [
                        {
                            id: 'd1',
                            channel: 'slack',
                            kind: 'retro_link',
                            status: 'queued',
                            error: null,
                            sentAt: null,
                            createdAt: null,
                            recipientCount: null,
                        } as never,
                    ],
                }),
            ),
        );

        expect(screen.getByText('Sending to Slack…')).toBeTruthy();

        fireEvent.click(screen.getByLabelText('Include the guest link'));
        fireEvent.click(
            screen.getByRole('button', { name: 'Post link to Slack' }),
        );

        await waitFor(() =>
            expect(retroRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: expect.stringContaining('/retros/retro-1/shares'),
                }),
                { channel: 'slack', kind: 'link', include_guest_link: true },
            ),
        );
    });

    it('offers no channel once the retro is completed', () => {
        renderInBoard(
            <BoardShare open onOpenChange={vi.fn()} />,
            boardContext(
                retroSnapshot({
                    integrations: slack,
                    retro: { phase: 'completed' },
                }),
            ),
        );

        expect(
            screen.queryByRole('button', { name: 'Post link to Slack' }),
        ).toBeNull();
        expect(screen.getByLabelText('Guest link')).toBeTruthy();
    });

    it('gives a manager who is not the facilitator the channels only', () => {
        renderInBoard(
            <BoardShare open onOpenChange={vi.fn()} />,
            boardContext(
                retroSnapshot({
                    integrations: slack,
                    viewer: { isFacilitator: false },
                    retro: { guestUrl: null },
                }),
            ),
        );

        expect(
            screen.getByRole('button', { name: 'Post link to Slack' }),
        ).toBeTruthy();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.queryByLabelText('Guest link')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Create a new link' }),
        ).toBeNull();
    });
});
