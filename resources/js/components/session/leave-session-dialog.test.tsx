import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaveSessionDialog } from '@/components/session/leave-session-dialog';
import { renderWithProviders } from '@/test/render';

const visit = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { visit },
}));

const Leave = 'Leave, the session continues';
const End = 'End the session';

function renderDialog({
    peopleCount = 3,
    endNote,
    onEnd = vi.fn().mockResolvedValue(undefined),
}: {
    peopleCount?: number;
    endNote?: string;
    onEnd?: () => Promise<void>;
} = {}) {
    const onOpenChange = vi.fn();

    renderWithProviders(
        <LeaveSessionDialog
            open
            onOpenChange={onOpenChange}
            title="Sprint 42"
            peopleCount={peopleCount}
            backHref="/teams/t1"
            endNote={endNote}
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
            'It keeps running. You can come back.',
        );
        expect(dialog.textContent).toContain('It closes for everyone.');
    });

    it('counts nobody when the facilitator is alone', () => {
        const { dialog } = renderDialog({ peopleCount: 1 });

        expect(dialog.textContent).not.toContain('still running for');
        expect(dialog.textContent).toContain('It closes for everyone.');
        expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    });

    it('adds what ending costs after what End does, when the session says it', () => {
        const { dialog } = renderDialog({
            endNote: 'The remaining phases are skipped.',
        });

        expect(dialog.textContent).toContain(
            'It closes for everyone. The remaining phases are skipped.',
        );
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

        fireEvent.click(button(Leave));

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

        fireEvent.click(button(End));

        await waitFor(() => expect(visit).toHaveBeenCalledWith('/teams/t1'));
        expect(order).toEqual(['ended', 'left']);
    });

    it('stays open and says so when ending fails, and goes nowhere', async () => {
        const { dialog, button, onOpenChange } = renderDialog({
            onEnd: vi.fn().mockRejectedValue(new Error('refused')),
        });

        fireEvent.click(button(End));

        expect((await within(dialog).findByRole('alert')).textContent).toBe(
            'Something went wrong. Please try again.',
        );
        expect(visit).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(button(End).disabled).toBe(false);
    });

    it('disables the buttons while ending', async () => {
        let finish: () => void = () => {};
        const { button } = renderDialog({
            onEnd: () =>
                new Promise<void>((resolve) => {
                    finish = resolve;
                }),
        });

        fireEvent.click(button(End));

        await waitFor(() => expect(button(End).disabled).toBe(true));
        expect(button('Stay').disabled).toBe(true);
        expect(button(Leave).disabled).toBe(true);
        expect(button(End).querySelector('[role="status"]')).not.toBeNull();

        finish();

        await waitFor(() => expect(visit).toHaveBeenCalledWith('/teams/t1'));
    });

    it('puts each consequence under its choice', () => {
        const { dialog, button } = renderDialog({
            endNote: 'The remaining phases are skipped.',
        });
        const described = (name: string) =>
            dialog.ownerDocument.getElementById(
                button(name).getAttribute('aria-describedby') ?? '',
            );

        expect(described(Leave)?.textContent).toBe(
            'It keeps running. You can come back.',
        );
        expect(button(Leave).contains(described(Leave))).toBe(true);
        expect(described(End)?.textContent).toBe(
            'It closes for everyone. The remaining phases are skipped.',
        );
        expect(button(End).contains(described(End))).toBe(true);
        expect(
            button(Leave).compareDocumentPosition(button(End)) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(button(End).className).toContain('border-destructive');
        expect(
            button('Stay').closest('[data-slot="dialog-footer"]')?.children,
        ).toHaveLength(1);
    });

    it('focuses Stay on open', async () => {
        const { button } = renderDialog();

        await waitFor(() =>
            expect(document.activeElement).toBe(button('Stay')),
        );
    });

    it('reaches End after Leave with the keyboard', async () => {
        const user = userEvent.setup();
        const { button } = renderDialog();
        const visited: Element[] = [];

        await waitFor(() =>
            expect(document.activeElement).toBe(button('Stay')),
        );

        for (let step = 0; step < 4; step += 1) {
            await user.tab();
            visited.push(document.activeElement as Element);
        }

        expect(visited.indexOf(button(Leave))).toBeGreaterThan(-1);
        expect(visited.indexOf(button(End))).toBe(
            visited.indexOf(button(Leave)) + 1,
        );
        expect(visited[0]).not.toBe(button(End));
    });
});
