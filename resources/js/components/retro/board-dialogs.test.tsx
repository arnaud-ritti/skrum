import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DeleteRetroDialog,
    HandoverDialog,
} from '@/components/retro/board-dialogs';
import { BoardContext } from '@/components/retro/board-context';
import { RetroRequestError } from '@/lib/retro/api';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());
const visit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { visit },
}));

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue(null);
    visit.mockReset();
});

describe('DeleteRetroDialog', () => {
    it('asks for confirmation, then deletes and goes back to the team', async () => {
        renderInBoard(
            <DeleteRetroDialog open onOpenChange={vi.fn()} />,
            boardContext(),
        );

        const dialog = screen.getByRole('alertdialog', {
            name: 'Delete retrospective',
        });

        expect(dialog.textContent).toContain(
            'Delete this retrospective? Everyone loses access to it.',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        await waitFor(() =>
            expect(visit).toHaveBeenCalledWith('/teams/team-1'),
        );
        expect(retroRequest).toHaveBeenCalledWith(
            expect.objectContaining({ method: 'delete' }),
        );
    });

    it('says how many open action items go with it', () => {
        renderInBoard(
            <DeleteRetroDialog open onOpenChange={vi.fn()} />,
            boardContext(
                retroSnapshot({
                    actionItems: [
                        { id: 'a', status: 'open' },
                        { id: 'b', status: 'doing' },
                        { id: 'c', status: 'completed' },
                    ] as never,
                }),
            ),
        );

        expect(
            screen.getByText('This also deletes 2 open action items.'),
        ).toBeTruthy();
    });

    it('shows why the server refused and stays open', async () => {
        retroRequest.mockRejectedValue(
            new RetroRequestError(403, 'Forbidden.'),
        );

        const onOpenChange = vi.fn();

        renderInBoard(
            <DeleteRetroDialog open onOpenChange={onOpenChange} />,
            boardContext(),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Forbidden.')).toBeTruthy();
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
        expect(visit).not.toHaveBeenCalled();
    });
});

describe('HandoverDialog', () => {
    it('says so when nobody else can facilitate, with Cancel as the only action', () => {
        renderInBoard(
            <HandoverDialog open onOpenChange={vi.fn()} />,
            boardContext(),
        );

        expect(
            screen.getByText(
                'No one else can facilitate this retrospective yet.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Hand over' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    it('lists the candidates under "New facilitator"', () => {
        renderInBoard(
            <HandoverDialog open onOpenChange={vi.fn()} />,
            boardContext(
                retroSnapshot({
                    viewer: {
                        transferCandidates: [
                            { userId: 'u2', name: 'Bob Stone' },
                        ] as never,
                    },
                }),
            ),
        );

        expect(
            screen.getByRole('dialog', { name: 'Hand over facilitation' }),
        ).toBeTruthy();
        expect(screen.getByLabelText('New facilitator')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Hand over' })).toBeTruthy();
    });

    it("shows each person's avatar in the list", () => {
        renderInBoard(
            <HandoverDialog open onOpenChange={vi.fn()} />,
            boardContext(
                retroSnapshot({
                    viewer: {
                        transferCandidates: [
                            { userId: 'u2', name: 'Bob Stone', avatarUrl: '' },
                            { userId: 'u3', name: 'Carol Diaz', avatarUrl: '' },
                        ],
                    } as never,
                }),
            ),
        );

        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });

        expect(
            screen
                .getAllByRole('option')
                .every(
                    (option) =>
                        option.querySelector('[data-slot="person-avatar"]') !==
                        null,
                ),
        ).toBe(true);
    });

    it('offers "Hand over" only for a candidate still in the list', () => {
        const withCandidates = (
            transferCandidates: { userId: string; name: string }[],
        ) =>
            boardContext(
                retroSnapshot({
                    viewer: { transferCandidates } as never,
                }),
            );
        const { rerender } = renderInBoard(
            <HandoverDialog open onOpenChange={vi.fn()} />,
            withCandidates([
                { userId: 'u2', name: 'Bob Stone' },
                { userId: 'u3', name: 'Carol Diaz' },
            ]),
        );
        const handOver = () =>
            screen.getByRole('button', {
                name: 'Hand over',
            }) as HTMLButtonElement;

        expect(handOver().disabled).toBe(true);

        fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
        fireEvent.keyDown(screen.getByRole('option', { name: 'Bob Stone' }), {
            key: 'Enter',
        });

        expect(handOver().disabled).toBe(false);

        rerender(
            <BoardContext
                value={withCandidates([{ userId: 'u3', name: 'Carol Diaz' }])}
            >
                <HandoverDialog open onOpenChange={vi.fn()} />
            </BoardContext>,
        );

        expect(handOver().disabled).toBe(true);
    });
});
