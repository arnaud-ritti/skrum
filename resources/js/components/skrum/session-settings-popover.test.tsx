import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionSettingsPopover } from '@/components/skrum/session-settings-popover';
import type {
    SessionSettings,
    SessionSettingsPopoverProps,
} from '@/components/skrum/session-settings-popover';
import { renderWithProviders } from '@/test/render';

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
    toast: { success: toastSuccess },
}));

const base: SessionSettings = {
    anonymousCards: true,
    boardLocked: false,
    votesPerPerson: 5,
    maxVotesPerCard: 2,
    hideVotesUntilReveal: false,
    phaseTimerMinutes: 5,
    showCursors: true,
    reactionsEnabled: true,
};

function Harness(overrides: Partial<SessionSettingsPopoverProps>) {
    const [draft, setDraft] = useState<Partial<SessionSettings>>(
        overrides.draft ?? {},
    );

    return (
        <SessionSettingsPopover
            open
            onOpenChange={vi.fn()}
            sessionTitle="Sprint 42 retro"
            phase="writing"
            value={base}
            variant="sheet"
            surveys={{
                healthCheckStatements: 6,
                templates: [{ id: 't1', title: 'Mad Sad Glad' }],
            }}
            onAddSurvey={vi.fn()}
            onApply={vi.fn().mockResolvedValue(undefined)}
            onReset={() => setDraft({})}
            {...overrides}
            draft={draft}
            onDraftChange={(next) => {
                setDraft(next);
                overrides.onDraftChange?.(next);
            }}
        />
    );
}

beforeEach(() => {
    toastSuccess.mockClear();
});

describe('SessionSettingsPopover', () => {
    it('starts with nothing modified and apply and reset disabled', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('No changes')).toBeTruthy();
        expect(
            (screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(
            (screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('reports a switch change as a draft and counts it', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Lock board' }),
        );

        expect(onDraftChange).toHaveBeenCalledWith({ boardLocked: true });
        expect(screen.getByText('1 unapplied change')).toBeTruthy();
        expect(screen.getByText('Modified')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Apply (1)' })).toBeTruthy();
    });

    it('drops a draft key when the value returns to the applied one', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);
        const lock = screen.getByRole('switch', { name: 'Lock board' });

        await userEvent.click(lock);
        await userEvent.click(lock);

        expect(onDraftChange).toHaveBeenLastCalledWith({});
        expect(screen.getByText('No changes')).toBeTruthy();
    });

    it('keeps max per card within votes per person', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(
            <Harness
                value={{ ...base, votesPerPerson: 3, maxVotesPerCard: 3 }}
                onDraftChange={onDraftChange}
            />,
        );
        const [votesGroup, maxGroup] = [
            screen.getByRole('group', { name: 'Votes per person' }),
            screen.getByRole('group', { name: 'Max per card' }),
        ];

        expect(
            (
                within(maxGroup).getByRole('button', {
                    name: 'Increase',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        await userEvent.click(
            within(votesGroup).getByRole('button', { name: 'Decrease' }),
        );

        expect(onDraftChange).toHaveBeenCalledWith({
            votesPerPerson: 2,
            maxVotesPerCard: 2,
        });
    });

    it('disables stepper bounds', () => {
        renderWithProviders(
            <Harness value={{ ...base, votesPerPerson: 10 }} />,
        );
        const group = screen.getByRole('group', { name: 'Votes per person' });

        expect(
            (
                within(group).getByRole('button', {
                    name: 'Increase',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('changes a stepper with arrow keys on the value', () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);
        const group = screen.getByRole('group', { name: 'Votes per person' });
        const output = group.querySelector('output') as HTMLElement;

        fireEvent.keyDown(output, { key: 'ArrowUp' });

        expect(onDraftChange).toHaveBeenCalledWith({ votesPerPerson: 6 });
    });

    it('applies only the modified keys and toasts with an undo', async () => {
        const onApply = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(<Harness onApply={onApply} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Lock board' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Apply (1)' }),
        );

        await waitFor(() =>
            expect(onApply).toHaveBeenCalledWith({ boardLocked: true }),
        );
        await waitFor(() => expect(toastSuccess).toHaveBeenCalled());

        const [message, options] = toastSuccess.mock.calls[0];
        expect(message).toBe('Settings applied');
        expect(options.duration).toBe(5000);

        options.action.onClick();

        expect(onApply).toHaveBeenLastCalledWith({ boardLocked: false });
        expect(screen.getByText('No changes')).toBeTruthy();
    });

    it('applies with Ctrl+Enter', async () => {
        const onApply = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(<Harness onApply={onApply} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Lock board' }),
        );
        fireEvent.keyDown(screen.getByRole('switch', { name: 'Lock board' }), {
            key: 'Enter',
            ctrlKey: true,
        });

        await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    });

    it('disables controls while applying', async () => {
        let resolve: () => void = () => {};
        const onApply = vi.fn(
            () =>
                new Promise<void>((done) => {
                    resolve = done;
                }),
        );
        renderWithProviders(<Harness onApply={onApply} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Lock board' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Apply (1)' }),
        );

        expect(
            (
                screen.getByRole('switch', {
                    name: 'Lock board',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        resolve();
        await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    });

    it('does not toast when apply fails', async () => {
        const onApply = vi.fn().mockRejectedValue(new Error('nope'));
        renderWithProviders(<Harness onApply={onApply} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Lock board' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Apply (1)' }),
        );

        await waitFor(() => expect(onApply).toHaveBeenCalled());
        expect(toastSuccess).not.toHaveBeenCalled();
        expect(screen.getByText('1 unapplied change')).toBeTruthy();
    });

    it('warns when a modified setting applies from the next phase', () => {
        renderWithProviders(
            <Harness
                draft={{ phaseTimerMinutes: 7 }}
                deferred={[{ key: 'phaseTimerMinutes', fromPhase: 'grouping' }]}
            />,
        );

        const status = screen.getByText(/Timer per phase applies from/);

        expect(status.textContent).toContain('Grouping');
        expect(status.closest('[role="status"]')).toBeTruthy();
    });

    it('does not warn about deferred keys that are not modified', () => {
        renderWithProviders(
            <Harness
                deferred={[{ key: 'phaseTimerMinutes', fromPhase: 'grouping' }]}
            />,
        );

        expect(screen.queryByText(/applies from the next phase/)).toBeNull();
    });

    it('asks before closing with unapplied changes', async () => {
        const onOpenChange = vi.fn();
        renderWithProviders(
            <Harness
                draft={{ boardLocked: true, showCursors: false }}
                onOpenChange={onOpenChange}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.getByText('Discard 2 changes?')).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Keep editing' }),
        );
        expect(screen.queryByText('Discard 2 changes?')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));
        await userEvent.click(screen.getByRole('button', { name: 'Discard' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(screen.getByText('No changes')).toBeTruthy();
    });

    it('closes directly when nothing is modified', async () => {
        const onOpenChange = vi.fn();
        renderWithProviders(<Harness onOpenChange={onOpenChange} />);

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('adds a survey from the menu', async () => {
        const onAddSurvey = vi.fn();
        renderWithProviders(<Harness onAddSurvey={onAddSurvey} />);

        await userEvent.click(
            screen.getByRole('button', { name: /Add survey/ }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: /Health check/ }),
        );

        expect(onAddSurvey).toHaveBeenCalledWith('health_check');
    });

    it('picks a template survey', async () => {
        const onAddSurvey = vi.fn();
        renderWithProviders(<Harness onAddSurvey={onAddSurvey} />);

        await userEvent.click(
            screen.getByRole('button', { name: /Add survey/ }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: /From a template/ }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: 'Mad Sad Glad' }),
        );

        expect(onAddSurvey).toHaveBeenCalledWith({ templateId: 't1' });
    });

    it('shows the attached survey on the survey button', () => {
        renderWithProviders(<Harness attachedSurvey="Health check" />);

        expect(
            screen.getByRole('button', { name: /Health check added · Edit/ }),
        ).toBeTruthy();
    });

    it('hides the survey entry when no survey data is given', () => {
        renderWithProviders(<Harness surveys={undefined} />);

        expect(screen.queryByRole('button', { name: /Add survey/ })).toBeNull();
    });

    it('renders values as text without controls for a participant', () => {
        renderWithProviders(<Harness readOnly facilitatorName="Camille R." />);

        expect(
            screen.getByText(
                'Only the facilitator, Camille R., can change these settings.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
        expect(screen.queryByRole('button', { name: /Add survey/ })).toBeNull();
        expect(screen.getByText('5 min')).toBeTruthy();
        expect(screen.getByText('Unlocked')).toBeTruthy();
        expect(screen.getAllByText('On').length).toBeGreaterThan(0);
    });

    it('labels the dialog with its title', () => {
        renderWithProviders(<Harness variant="popover" />);

        const dialog = screen.getByRole('dialog');

        expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
        expect(
            within(dialog).getByRole('heading', { name: 'Session settings' }),
        ).toBeTruthy();
    });
});
