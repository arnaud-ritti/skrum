import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameTruthSets } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { TwoTruthsSetForm } from './two-truths-set-form';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const readySet = {
    statements: ['I have met a bear', 'I speak Welsh', 'I ran a marathon'],
    lieIndex: 1,
    played: false,
};

function renderForm(truthSets: GameTruthSets | null) {
    const dispatch = vi.fn();
    const ctx = {
        snapshot: {
            room: { id: 'room', game: 'two_truths' },
            me: { playerId: 'ada' },
            players: [],
            truthSets,
        },
        online: [],
        dispatch,
        run: <T,>(mutation: Promise<T>) =>
            mutation.catch(() => undefined) as Promise<T | undefined>,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <TwoTruthsSetForm />
        </RoomProvider>,
    );

    return { dispatch };
}

function fill(statements: string[]) {
    statements.forEach((statement, index) => {
        fireEvent.change(
            screen.getByLabelText(`Statement ${index + 1}`, {
                selector: 'textarea',
            }),
            { target: { value: statement } },
        );
    });
}

function save(): HTMLButtonElement {
    return screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
}

describe('TwoTruthsSetForm', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('renders nothing outside Two truths', () => {
        renderForm(null);

        expect(
            document.querySelector('[data-slot="two-truths-set-form"]'),
        ).toBeNull();
    });

    it('saves three distinct statements and the lie', async () => {
        mocks.request.mockResolvedValue({ mine: readySet });
        const { dispatch } = renderForm({ ready: [], mine: null });

        expect(screen.getByText('My statements')).toBeTruthy();
        expect(save().disabled).toBe(true);

        fill(readySet.statements);

        expect(screen.getByText('13 / 120')).toBeTruthy();
        expect(save().disabled).toBe(true);

        fireEvent.click(screen.getByRole('radio', { name: 'Statement 2' }));

        expect(save().disabled).toBe(false);

        await act(async () => {
            fireEvent.click(save());
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(mocks.request.mock.calls[0][1]).toEqual({
            statements: readySet.statements,
            lie_index: 1,
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'statements.mine',
            mine: readySet,
        });
    });

    it('keeps Save disabled for the same statement twice, case ignored', () => {
        renderForm({ ready: [], mine: null });

        fill(['I ski', 'i SKI', 'I fly']);
        fireEvent.click(screen.getByRole('radio', { name: 'Statement 3' }));

        expect(save().disabled).toBe(true);
    });

    it('shows a ready set with Edit and Remove', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderForm({ ready: ['ada'], mine: readySet });

        expect(screen.getByText('Statements ready')).toBeTruthy();
        expect(screen.getByText('I speak Welsh')).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'statements.mine',
            mine: null,
        });
    });

    it('opens the ready set for editing', () => {
        renderForm({ ready: ['ada'], mine: readySet });

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

        expect(
            (
                screen.getByLabelText('Statement 2', {
                    selector: 'textarea',
                }) as HTMLTextAreaElement
            ).value,
        ).toBe('I speak Welsh');
        expect(save().disabled).toBe(false);
    });

    it('keeps the set when the server refuses its removal', async () => {
        mocks.request.mockRejectedValue(new Error('played'));
        const { dispatch } = renderForm({ ready: ['ada'], mine: readySet });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        });

        expect(dispatch).not.toHaveBeenCalled();
        expect(screen.getByText('Statements ready')).toBeTruthy();
    });

    it('offers new statements once the set was played', () => {
        renderForm({ ready: [], mine: { ...readySet, played: true } });

        expect(screen.getByText('Played')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Write new ones' }));

        expect(
            (
                screen.getByLabelText('Statement 1', {
                    selector: 'textarea',
                }) as HTMLTextAreaElement
            ).value,
        ).toBe('');
    });
});
