import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaveSessionDialog } from '@/components/session/leave-session-dialog';
import { renderWithProviders } from '@/test/render';

const visit = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { visit },
}));

function renderDialog({
    peopleCount = 3,
    onEnd = vi.fn().mockResolvedValue(undefined),
}: { peopleCount?: number; onEnd?: () => Promise<void> } = {}) {
    const onOpenChange = vi.fn();

    renderWithProviders(
        <LeaveSessionDialog
            open
            onOpenChange={onOpenChange}
            title="Sprint 42"
            peopleCount={peopleCount}
            backHref="/teams/t1"
            onEnd={onEnd}
        />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Leave Sprint 42?' });
    const button = (name: string) =>
        within(dialog).getByRole('button', { name }) as HTMLButtonElement;

    return { dialog, button, onOpenChange, onEnd };
}

beforeEach(() => {
    visit.mockReset();
});

describe('LeaveSessionDialog', () => {
    it('says who the session still runs for and what each choice does', () => {
        const { dialog } = renderDialog();

        expect(dialog.textContent).toContain(
            'The session is still running for 3 people.',
        );
        expect(dialog.textContent).toContain(
            'Leave: it keeps running, you can come back.',
        );
        expect(dialog.textContent).toContain('End: it closes for everyone.');
    });

    it('counts nobody when the facilitator is alone', () => {
        const { dialog } = renderDialog({ peopleCount: 1 });

        expect(dialog.textContent).not.toContain('still running for');
        expect(dialog.textContent).toContain('End: it closes for everyone.');
    });

    it('Stay closes the dialog, ends nothing and goes nowhere', () => {
        const { button, onOpenChange, onEnd } = renderDialog();

        fireEvent.click(button('Stay'));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onEnd).not.toHaveBeenCalled();
        expect(visit).not.toHaveBeenCalled();
    });

    it('Leave, keep running goes to the team without ending', () => {
        const { button, onEnd } = renderDialog();

        fireEvent.click(button('Leave, keep running'));

        expect(visit).toHaveBeenCalledWith('/teams/t1');
        expect(onEnd).not.toHaveBeenCalled();
    });

    it('End it ends, then goes to the team', async () => {
        const order: string[] = [];
        const onEnd = vi.fn(async () => {
            order.push('ended');
        });

        visit.mockImplementation(() => order.push('left'));

        const { button } = renderDialog({ onEnd });

        fireEvent.click(button('End it'));

        await waitFor(() => expect(visit).toHaveBeenCalledWith('/teams/t1'));
        expect(order).toEqual(['ended', 'left']);
    });

    it('stays open and says so when ending fails, and goes nowhere', async () => {
        const { dialog, button, onOpenChange } = renderDialog({
            onEnd: vi.fn().mockRejectedValue(new Error('refused')),
        });

        fireEvent.click(button('End it'));

        expect((await within(dialog).findByRole('alert')).textContent).toBe(
            'Something went wrong. Please try again.',
        );
        expect(visit).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(button('End it').disabled).toBe(false);
    });

    it('disables the buttons while ending', async () => {
        let finish: () => void = () => {};
        const { button } = renderDialog({
            onEnd: () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        });

        fireEvent.click(button('End it'));

        await waitFor(() => expect(button('End it').disabled).toBe(true));
        expect(button('Stay').disabled).toBe(true);
        expect(button('Leave, keep running').disabled).toBe(true);

        finish();

        await waitFor(() => expect(visit).toHaveBeenCalledWith('/teams/t1'));
    });
});
