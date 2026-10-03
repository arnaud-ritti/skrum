import {
    fireEvent,
    renderHook,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SessionSettingsPopover,
    useRetroSettingGroups,
} from '@/components/skrum/session-settings-popover';
import type {
    RetroSettingsContext,
    RetroSettingsValues,
    SessionSetting,
    SessionSettingGroup,
    SessionSettingsPopoverProps,
} from '@/components/skrum/session-settings-popover';
import { renderWithProviders } from '@/test/render';

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
    toast: { success: toastSuccess },
}));

const base: RetroSettingsValues = {
    title: 'Sprint 42 retro',
    is_anonymous: true,
    votes_per_participant: 5,
    icebreaker_enabled: false,
    icebreaker_game: 'draw',
    reactions_enabled: true,
    cursors_enabled: true,
    gifs_enabled: true,
    hide_vote_counts: false,
    is_locked: false,
    presentation_mode: false,
    ai_summary_enabled: false,
};

const context: RetroSettingsContext = {
    phase: 'writing',
    isAnonymous: true,
    icebreakerGame: 'draw',
    votesPerParticipant: 5,
    hasCards: false,
    icebreakerGames: [
        { value: 'draw', label: 'Draw', available: true },
        { value: 'gif', label: 'GIF', available: false },
        { value: 'hangman', label: 'Hangman', available: true },
    ],
    gifProvider: 'giphy',
    llmProvider: 'Mistral',
};

type HarnessProps = Partial<
    SessionSettingsPopoverProps<RetroSettingsValues>
> & {
    context?: Partial<RetroSettingsContext>;
};

function Harness({ context: contextOverrides, ...overrides }: HarnessProps) {
    const [draft, setDraft] = useState<Partial<RetroSettingsValues>>(
        overrides.draft ?? {},
    );
    const value = overrides.value ?? base;
    const groups = useRetroSettingGroups({
        ...context,
        isAnonymous: value.is_anonymous,
        ...contextOverrides,
    });

    return (
        <SessionSettingsPopover
            open
            onOpenChange={vi.fn()}
            sessionTitle="Sprint 42 retro"
            phase={contextOverrides?.phase ?? 'writing'}
            groups={groups}
            value={base}
            variant="sheet"
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

function settingsOf(
    overrides: Partial<RetroSettingsContext> = {},
): Record<string, SessionSetting> {
    const { result } = renderHook(() =>
        useRetroSettingGroups({ ...context, ...overrides }),
    );

    return Object.fromEntries(
        result.current
            .flatMap((group) => group.settings)
            .map((setting) => [setting.key, setting]),
    );
}

function isDisabled(element: HTMLElement): boolean {
    return (element as HTMLButtonElement).disabled;
}

beforeEach(() => {
    toastSuccess.mockClear();
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => undefined;
});

describe('useRetroSettingGroups', () => {
    it('lists every setting the retro settings endpoint accepts, under its request key', () => {
        expect(Object.keys(settingsOf())).toEqual([
            'title',
            'is_anonymous',
            'is_locked',
            'votes_per_participant',
            'hide_vote_counts',
            'icebreaker_enabled',
            'icebreaker_game',
            'reactions_enabled',
            'cursors_enabled',
            'gifs_enabled',
            'presentation_mode',
            'ai_summary_enabled',
        ]);
    });

    it('keeps the element ids the browser tests use', () => {
        const settings = settingsOf();

        expect(settings.is_locked.id).toBe('retro-locked');
        expect(settings.hide_vote_counts.id).toBe('retro-hide-vote-counts');
        expect(settings.icebreaker_enabled.id).toBe('retro-icebreaker');
        expect(settings.reactions_enabled.id).toBe('retro-reactions');
        expect(settings.cursors_enabled.id).toBe('retro-cursors');
        expect(settings.gifs_enabled.id).toBe('retro-gifs');
        expect(settings.presentation_mode.id).toBe('retro-presentation');
        expect(settings.ai_summary_enabled.id).toBe('retro-ai-summary');
    });

    it('allows 1 to 20 votes, or automatic', () => {
        const votes = settingsOf().votes_per_participant;

        expect(votes).toMatchObject({
            type: 'stepper',
            min: 1,
            max: 20,
            auto: { id: 'retro-votes-auto', fallback: 5 },
        });
    });

    it('locks the vote limit once voting has started, and in phases added later', () => {
        for (const phase of ['health_check', 'icebreaker', 'grouping']) {
            expect(
                settingsOf({ phase }).votes_per_participant.disabledReason,
            ).toBeUndefined();
        }

        for (const phase of ['voting', 'discussing', 'actions', 'roti']) {
            expect(
                settingsOf({ phase }).votes_per_participant.disabledReason,
            ).toBe('The vote limit can only change before voting starts.');
        }
    });

    it('refuses to turn off the phase the retro is in', () => {
        const reason = 'Move to another phase before turning this phase off.';

        expect(
            settingsOf({ phase: 'icebreaker' }).icebreaker_enabled
                .disabledReason,
        ).toBe(reason);
        expect(
            settingsOf({ phase: 'writing' }).icebreaker_enabled.disabledReason,
        ).toBeUndefined();
    });

    it('has no health-check toggle: a health check is added from "Add survey"', () => {
        expect(settingsOf().health_check_enabled).toBeUndefined();
        expect(
            settingsOf({ phase: 'health_check' }).health_check_enabled,
        ).toBeUndefined();
    });

    it('locks anonymity once cards or answers exist, only while it is on', () => {
        expect(settingsOf({ hasCards: true }).is_anonymous.disabledReason).toBe(
            'Anonymity can only be turned off before any card is written.',
        );
        expect(
            settingsOf({ hasAnswers: true }).is_anonymous.disabledReason,
        ).toBe('Anonymity can only be turned off before anyone answers.');
        expect(
            settingsOf({ hasCards: true, isAnonymous: false }).is_anonymous
                .disabledReason,
        ).toBeUndefined();
    });

    it('locks everything but the title and anonymity on a completed retro', () => {
        const settings = settingsOf({ phase: 'completed' });
        const reason = 'This retrospective is completed.';

        expect(settings.title.disabledReason).toBeUndefined();
        expect(settings.is_locked.disabledReason).toBe(reason);
        expect(settings.hide_vote_counts.disabledReason).toBe(reason);
        expect(settings.icebreaker_game.disabledReason).toBe(reason);
        expect(settings.presentation_mode.disabledReason).toBe(reason);
        expect(settings.ai_summary_enabled.disabledReason).toBe(reason);
    });

    it('leaves out GIFs and the AI summary without a provider', () => {
        const settings = settingsOf({ gifProvider: null, llmProvider: null });

        expect(settings.gifs_enabled).toBeUndefined();
        expect(settings.ai_summary_enabled).toBeUndefined();
    });

    it('offers available games and keeps the current one when it is not', () => {
        const available = settingsOf().icebreaker_game;
        const current = settingsOf({ icebreakerGame: 'gif' }).icebreaker_game;

        expect(
            available.type === 'select' &&
                available.options.map((option) => option.value),
        ).toEqual(['draw', 'hangman']);
        expect(current.type === 'select' && current.options[1]).toEqual({
            value: 'gif',
            label: 'GIF',
            disabled: true,
        });
    });
});

describe('SessionSettingsPopover', () => {
    it('starts with nothing modified and apply and reset disabled', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('No changes')).toBeTruthy();
        expect(isDisabled(screen.getByRole('button', { name: 'Apply' }))).toBe(
            true,
        );
        expect(isDisabled(screen.getByRole('button', { name: 'Reset' }))).toBe(
            true,
        );
    });

    it('keeps the apply bar in view while a long panel scrolls', () => {
        renderWithProviders(<Harness />);

        const footer = screen
            .getByRole('button', { name: 'Apply' })
            .closest('[data-slot="session-settings-footer"]');

        expect(footer?.classList.contains('sticky')).toBe(true);
        expect(footer?.classList.contains('bottom-0')).toBe(true);
    });

    it('puts the given id on each control', () => {
        renderWithProviders(<Harness />);

        expect(
            screen.getByRole('switch', { name: 'Close for editing' }).id,
        ).toBe('retro-locked');
        expect(
            screen.getByRole('switch', { name: 'Hide vote counts' }).id,
        ).toBe('retro-hide-vote-counts');
        expect(screen.getByRole('textbox', { name: 'Title' }).id).toBe(
            'retro-title',
        );
        expect(
            screen.getByRole('spinbutton', { name: 'Votes per participant' })
                .id,
        ).toBe('retro-votes');
    });

    it('reports a switch change as a draft and counts it', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Close for editing' }),
        );

        expect(onDraftChange).toHaveBeenCalledWith({ is_locked: true });
        expect(screen.getByText('1 unapplied change')).toBeTruthy();
        expect(screen.getByText('Modified')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Apply (1)' })).toBeTruthy();
    });

    it('drops a draft key when the value returns to the applied one', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);
        const lock = screen.getByRole('switch', { name: 'Close for editing' });

        await userEvent.click(lock);
        await userEvent.click(lock);

        expect(onDraftChange).toHaveBeenLastCalledWith({});
        expect(screen.getByText('No changes')).toBeTruthy();
    });

    it('shows and keeps a vote limit above ten, up to the server maximum', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(
            <Harness
                value={{ ...base, votes_per_participant: 19 }}
                onDraftChange={onDraftChange}
            />,
        );
        const group = screen.getByRole('group', {
            name: 'Votes per participant',
        });
        const increase = within(group).getByRole('button', {
            name: 'Increase',
        });

        expect(
            (within(group).getByRole('spinbutton') as HTMLInputElement).value,
        ).toBe('19');

        await userEvent.click(increase);

        expect(onDraftChange).toHaveBeenCalledWith({
            votes_per_participant: 20,
        });
        expect(isDisabled(increase)).toBe(true);
    });

    it('changes a stepper with the arrow keys and by typing, within its range', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);
        const input = screen.getByRole('spinbutton', {
            name: 'Votes per participant',
        }) as HTMLInputElement;

        fireEvent.keyDown(input, { key: 'ArrowUp' });

        expect(onDraftChange).toHaveBeenLastCalledWith({
            votes_per_participant: 6,
        });

        await userEvent.clear(input);
        await userEvent.type(input, '12');

        expect(onDraftChange).toHaveBeenLastCalledWith({
            votes_per_participant: 12,
        });

        await userEvent.clear(input);
        await userEvent.type(input, '99');
        await userEvent.tab();

        expect(input.value).toBe('9');
    });

    it('switches the vote limit to automatic and back to the effective number', async () => {
        const onDraftChange = vi.fn();
        renderWithProviders(<Harness onDraftChange={onDraftChange} />);
        const auto = screen.getByRole('switch', {
            name: 'Automatic vote limit',
        });

        expect(auto.id).toBe('retro-votes-auto');

        await userEvent.click(auto);

        expect(onDraftChange).toHaveBeenLastCalledWith({
            votes_per_participant: null,
        });
        expect(screen.queryByRole('spinbutton')).toBeNull();
        expect(
            screen.getByText('Automatic: number of cards plus 3, at most 10.'),
        ).toBeTruthy();

        await userEvent.click(auto);

        expect(onDraftChange).toHaveBeenLastCalledWith({});
        expect(screen.getByRole('spinbutton')).toBeTruthy();
    });

    it('shows the game choice only while the icebreaker is on', async () => {
        renderWithProviders(<Harness />);

        expect(screen.queryByText('Icebreaker game')).toBeNull();

        await userEvent.click(
            screen.getByRole('switch', { name: 'Icebreaker' }),
        );

        expect(
            screen.getByRole('combobox', { name: 'Icebreaker game' }).id,
        ).toBe('retro-icebreaker-game');
    });

    it('disables a setting and says why', () => {
        renderWithProviders(
            <Harness context={{ phase: 'voting', hasCards: true }} />,
        );
        const anonymous = screen.getByRole('switch', {
            name: 'Anonymous cards',
        });
        const reason = screen.getByText(
            'Anonymity can only be turned off before any card is written.',
        );

        expect(isDisabled(anonymous)).toBe(true);
        expect(anonymous.getAttribute('aria-describedby')).toBe(
            reason.closest('[data-slot="setting-reason"]')?.id,
        );
        expect(
            isDisabled(
                screen.getByRole('spinbutton', {
                    name: 'Votes per participant',
                }),
            ),
        ).toBe(true);
        expect(
            isDisabled(
                screen.getByRole('switch', { name: 'Automatic vote limit' }),
            ),
        ).toBe(true);
        expect(
            isDisabled(
                screen.getByRole('switch', { name: 'Close for editing' }),
            ),
        ).toBe(false);
    });

    it('edits the title and refuses an empty one', async () => {
        const onApply = vi.fn().mockResolvedValue(undefined);
        const onDraftChange = vi.fn();
        renderWithProviders(
            <Harness onApply={onApply} onDraftChange={onDraftChange} />,
        );
        const title = screen.getByRole('textbox', { name: 'Title' });

        expect(title.getAttribute('maxlength')).toBe('120');

        await userEvent.clear(title);

        expect(screen.getByText('This field is required.')).toBeTruthy();
        expect(
            isDisabled(screen.getByRole('button', { name: 'Apply (1)' })),
        ).toBe(true);

        await userEvent.type(title, 'Sprint 43');

        expect(onDraftChange).toHaveBeenLastCalledWith({ title: 'Sprint 43' });
    });

    it('shows a server error under its setting', () => {
        renderWithProviders(
            <Harness errors={{ ai_summary_enabled: 'Not available.' }} />,
        );

        expect(screen.getByRole('alert').textContent).toBe('Not available.');
    });

    it('applies only the modified keys and toasts with an undo', async () => {
        const onApply = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(<Harness onApply={onApply} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Close for editing' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Apply (1)' }),
        );

        await waitFor(() =>
            expect(onApply).toHaveBeenCalledWith({ is_locked: true }),
        );
        await waitFor(() => expect(toastSuccess).toHaveBeenCalled());

        const [message, options] = toastSuccess.mock.calls[0];
        expect(message).toBe('Settings applied');
        expect(options.duration).toBe(5000);

        options.action.onClick();

        expect(onApply).toHaveBeenLastCalledWith({ is_locked: false });
        expect(screen.getByText('No changes')).toBeTruthy();
    });

    it('applies with Ctrl+Enter', async () => {
        const onApply = vi.fn().mockResolvedValue(undefined);
        renderWithProviders(<Harness onApply={onApply} />);
        const lock = screen.getByRole('switch', { name: 'Close for editing' });

        await userEvent.click(lock);
        fireEvent.keyDown(lock, { key: 'Enter', ctrlKey: true });

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
        const lock = screen.getByRole('switch', { name: 'Close for editing' });

        await userEvent.click(lock);
        await userEvent.click(
            screen.getByRole('button', { name: 'Apply (1)' }),
        );

        expect(isDisabled(lock)).toBe(true);

        resolve();
        await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    });

    it('does not toast when apply fails', async () => {
        const onApply = vi.fn().mockRejectedValue(new Error('nope'));
        renderWithProviders(<Harness onApply={onApply} />);

        await userEvent.click(
            screen.getByRole('switch', { name: 'Close for editing' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Apply (1)' }),
        );

        await waitFor(() => expect(onApply).toHaveBeenCalled());
        expect(toastSuccess).not.toHaveBeenCalled();
        expect(screen.getByText('1 unapplied change')).toBeTruthy();
    });

    it('keeps the local draft when the applied values change remotely', () => {
        const { rerender } = renderWithProviders(
            <Harness draft={{ is_locked: true }} />,
        );

        rerender(
            <Harness
                value={{ ...base, hide_vote_counts: true, title: 'Renamed' }}
            />,
        );

        expect(
            screen
                .getByRole('switch', { name: 'Close for editing' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen
                .getByRole('switch', { name: 'Hide vote counts' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            (screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement)
                .value,
        ).toBe('Renamed');
        expect(screen.getByText('1 unapplied change')).toBeTruthy();
    });

    it('warns when a modified setting applies from the next phase', () => {
        renderWithProviders(
            <Harness
                draft={{ hide_vote_counts: true }}
                deferred={[{ key: 'hide_vote_counts', fromPhase: 'grouping' }]}
            />,
        );

        const status = screen.getByText(/Hide vote counts applies from/);

        expect(status.textContent).toContain('Grouping');
        expect(status.closest('[role="status"]')).toBeTruthy();
    });

    it('does not warn about deferred keys that are not modified', () => {
        renderWithProviders(
            <Harness
                deferred={[{ key: 'hide_vote_counts', fromPhase: 'grouping' }]}
            />,
        );

        expect(screen.queryByText(/applies from the next phase/)).toBeNull();
    });

    it('names every back-end phase in the header', () => {
        const { rerender } = renderWithProviders(
            <Harness phase="health_check" />,
        );

        expect(screen.getByText('Sprint 42 retro · Health check')).toBeTruthy();

        rerender(<Harness phase="completed" />);

        expect(screen.getByText('Sprint 42 retro · Completed')).toBeTruthy();
    });

    it('does not break on a phase it does not know', () => {
        const { rerender } = renderWithProviders(
            <Harness
                phase="wrap_up"
                draft={{ hide_vote_counts: true }}
                deferred={[{ key: 'hide_vote_counts', fromPhase: 'wrap_up' }]}
            />,
        );

        expect(screen.getByText('Sprint 42 retro')).toBeTruthy();
        expect(screen.queryByText(/undefined/)).toBeNull();
        expect(
            screen.getByText(
                'Hide vote counts applies from the next phase. The current one keeps running.',
            ),
        ).toBeTruthy();

        rerender(
            <Harness phase="wrap_up" phaseLabels={{ wrap_up: 'Wrap-up' }} />,
        );

        expect(screen.getByText('Sprint 42 retro · Wrap-up')).toBeTruthy();
    });

    it('asks before closing with unapplied changes', async () => {
        const onOpenChange = vi.fn();
        renderWithProviders(
            <Harness
                draft={{ is_locked: true, cursors_enabled: false }}
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

    it('opens the "Add survey" menu with the health check and the quick poll', async () => {
        const onAddSurvey = vi.fn();
        renderWithProviders(
            <Harness
                onAddSurvey={onAddSurvey}
                surveys={{
                    healthCheckStatements: 6,
                    healthCheckAttached: false,
                }}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Add survey' }),
        );

        const menu = screen.getByRole('menu');
        const items = within(menu).getAllByRole('menuitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'Health check6 statementsBuilt-in',
            'Quick pollOne question, answered on the board',
        ]);
        expect(within(menu).getByText('Add to this retro')).toBeTruthy();
        expect(within(menu).queryByText(/From a template/)).toBeNull();

        await userEvent.click(
            screen.getByRole('menuitem', { name: /^Health check/ }),
        );

        expect(onAddSurvey).toHaveBeenCalledWith('health_check');

        await userEvent.click(
            screen.getByRole('button', { name: 'Add survey' }),
        );
        await userEvent.click(
            screen.getByRole('menuitem', { name: /^Quick poll/ }),
        );

        expect(onAddSurvey).toHaveBeenLastCalledWith('quick_poll');
    });

    it('says when the health check is already added, and offers it no more', async () => {
        const onAddSurvey = vi.fn();
        renderWithProviders(
            <Harness
                onAddSurvey={onAddSurvey}
                surveys={{
                    healthCheckStatements: 6,
                    healthCheckAttached: true,
                }}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Add survey' }),
        );

        const item = screen.getByRole('menuitem', {
            name: /^Health check added/,
        });

        expect(item.getAttribute('aria-disabled')).toBe('true');
        expect(
            screen
                .getByRole('menuitem', { name: /^Quick poll/ })
                .getAttribute('aria-disabled'),
        ).toBeNull();
    });

    it('disables the quick poll where the retro takes none', async () => {
        renderWithProviders(
            <Harness
                onAddSurvey={vi.fn()}
                surveys={{
                    healthCheckStatements: 6,
                    healthCheckAttached: false,
                    quickPollAvailable: false,
                }}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Add survey' }),
        );

        expect(
            screen
                .getByRole('menuitem', { name: /^Quick poll/ })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });

    it('hides the survey entry without a callback', () => {
        renderWithProviders(<Harness />);

        expect(screen.queryByRole('button', { name: 'Add survey' })).toBeNull();
    });

    it('renders values as text without controls for a participant', () => {
        renderWithProviders(
            <Harness
                readOnly
                facilitatorName="Camille R."
                onAddSurvey={vi.fn()}
                value={{ ...base, icebreaker_enabled: true }}
                context={{ phase: 'voting', hasCards: true }}
            />,
        );

        expect(
            screen.getByText(
                'Only the facilitator, Camille R., can change these settings.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.queryByRole('spinbutton')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add survey' })).toBeNull();
        expect(screen.getByText('Unlocked')).toBeTruthy();
        expect(screen.getByText('Draw')).toBeTruthy();
        expect(screen.getAllByText('On').length).toBeGreaterThan(0);
        expect(
            screen.queryByText(
                'Anonymity can only be turned off before any card is written.',
            ),
        ).toBeNull();
    });

    it('takes any list of settings, with a slot and its own title', async () => {
        const groups: SessionSettingGroup[] = [
            {
                id: 'board',
                label: 'Board',
                settings: [
                    {
                        type: 'switch',
                        key: 'guest_access_enabled',
                        id: 'poker-guest-link-access',
                        label: 'Allow guests',
                    },
                    {
                        type: 'switch',
                        key: 'follow_enabled',
                        label: 'Follow the facilitator',
                    },
                ],
            },
        ];
        const onDraftChange = vi.fn();

        renderWithProviders(
            <SessionSettingsPopover
                open
                onOpenChange={vi.fn()}
                variant="sheet"
                title="Whiteboard settings"
                sessionTitle="Architecture"
                groups={groups}
                value={{ guest_access_enabled: false, follow_enabled: true }}
                onDraftChange={onDraftChange}
                onApply={vi.fn().mockResolvedValue(undefined)}
                onReset={vi.fn()}
            >
                <p>Deck fields</p>
            </SessionSettingsPopover>,
        );

        expect(
            screen.getByRole('dialog', { name: 'Whiteboard settings' }),
        ).toBeTruthy();
        expect(screen.getByText('Architecture')).toBeTruthy();
        expect(screen.getByText('Deck fields')).toBeTruthy();

        await userEvent.click(
            document.getElementById('poker-guest-link-access')!,
        );

        expect(onDraftChange).toHaveBeenCalledWith({
            guest_access_enabled: true,
        });
    });

    it('renders no group when the list is empty', () => {
        renderWithProviders(<Harness groups={[]} />);

        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.getByText('No changes')).toBeTruthy();
    });
});

describe('SessionSettingsPopover containers', () => {
    it.each(['popover', 'sheet', 'drawer'] as const)(
        'names the %s dialog with its title',
        (variant) => {
            renderWithProviders(<Harness variant={variant} />);

            const dialog = screen.getByRole('dialog', {
                name: 'Session settings',
            });

            expect(
                within(dialog).getByRole('heading', {
                    name: 'Session settings',
                }),
            ).toBeTruthy();
        },
    );

    it.each(['popover', 'sheet', 'drawer'] as const)(
        'renders the trigger of the %s variant',
        (variant) => {
            renderWithProviders(
                <Harness
                    open={false}
                    variant={variant}
                    trigger={<button type="button">Settings</button>}
                />,
            );

            expect(
                screen.getByRole('button', { name: 'Settings' }),
            ).toBeTruthy();
        },
    );

    function External({
        variant,
        withAnchor = false,
    }: {
        variant: 'popover' | 'sheet';
        withAnchor?: boolean;
    }) {
        const [open, setOpen] = useState(false);
        const anchorRef = useRef<HTMLButtonElement>(null);

        return (
            <>
                <button type="button" onClick={() => setOpen(true)}>
                    Open settings
                </button>
                <button type="button" ref={anchorRef}>
                    Anchor
                </button>
                <Harness
                    open={open}
                    onOpenChange={setOpen}
                    variant={variant}
                    anchorRef={withAnchor ? anchorRef : undefined}
                />
            </>
        );
    }

    it.each(['popover', 'sheet'] as const)(
        'returns focus to the opener when the %s has no trigger',
        async (variant) => {
            const user = userEvent.setup();
            renderWithProviders(<External variant={variant} />);
            const opener = screen.getByRole('button', {
                name: 'Open settings',
            });

            await user.click(opener);

            const dialog = await screen.findByRole('dialog');

            await waitFor(() =>
                expect(dialog.contains(document.activeElement)).toBe(true),
            );

            await user.keyboard('{Escape}');

            await waitFor(() =>
                expect(screen.queryByRole('dialog')).toBeNull(),
            );
            await waitFor(() => expect(document.activeElement).toBe(opener));
        },
    );

    it('returns focus to the anchor when one is given', async () => {
        const user = userEvent.setup();
        renderWithProviders(<External variant="popover" withAnchor />);

        await user.click(screen.getByRole('button', { name: 'Open settings' }));
        await user.click(
            within(await screen.findByRole('dialog')).getByRole('button', {
                name: 'Close',
            }),
        );

        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Anchor' }),
            ),
        );
    });
});
