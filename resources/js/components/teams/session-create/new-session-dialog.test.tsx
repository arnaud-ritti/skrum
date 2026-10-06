import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    NewSessionDialog,
    SessionFormFooter,
} from '@/components/teams/session-create/new-session-dialog';
import type { SessionForm } from '@/components/teams/session-create/new-session-dialog';
import { readNewSessionIntent } from '@/components/teams/session-create/use-new-session-intent';
import { retroSessionForm } from '@/components/teams/session-create/retro-session-fields';
import { surveySessionForm } from '@/components/teams/session-create/survey-session-fields';
import type { RetroSessionFormProps } from '@/components/teams/session-create/retro-session-fields';
import { Button } from '@/components/ui/button';
import { renderWithProviders } from '@/test/render';
import type { CatalogueTemplate } from '@/types';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    reload: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { post: mocks.post, reload: mocks.reload },
    };
});

type VisitOptions = {
    only?: string[];
    onStart?: () => void;
    onSuccess?: (page: unknown) => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

function template(
    key: string,
    name: string,
    titles: string[],
    overrides: Partial<CatalogueTemplate> = {},
): CatalogueTemplate {
    const colors = ['moss', 'coral', 'sky', 'sun'] as const;

    return {
        key,
        name,
        category: 'essentials',
        isCommon: false,
        isWorkspace: false,
        columns: titles.map((title, index) => ({
            title,
            description: null,
            color: colors[index % colors.length],
        })),
        ...overrides,
    };
}

const catalogue: CatalogueTemplate[] = [
    template('workspace:w1', 'Team pulse', ['Energy', 'Blockers'], {
        isWorkspace: true,
        category: 'team_mood',
    }),
    template('custom', 'Custom', [], { category: null }),
    template('start_stop_continue', 'Start, Stop, Continue', [
        'Start',
        'Stop',
        'Continue',
    ]),
    template('four_ls', '4Ls', ['Liked', 'Learned', 'Lacked', 'Longed for']),
    template('sailboat', 'Sailboat', ['Wind', 'Anchors'], {
        category: 'themed',
    }),
    template('mad_sad_glad', 'Mad, Sad, Glad', ['Mad', 'Sad', 'Glad']),
    template('went_well', 'Went well', ['Went well', 'To improve']),
    template('kalm', 'KALM', ['Keep', 'Add', 'Less', 'More']),
];

const retroProps: RetroSessionFormProps = {
    workspaceSlug: 'acme',
    categories: [
        { value: 'essentials', label: 'Essentials' },
        { value: 'team_mood', label: 'Team & mood' },
        { value: 'themed', label: 'Themed & fun' },
    ],
    catalogue,
    topTemplates: [
        'sailboat',
        'start_stop_continue',
        'four_ls',
        'mad_sad_glad',
        'went_well',
    ],
    icebreakerGames: [
        { value: 'draw', label: 'Draw & Guess', available: true },
        { value: 'hangman', label: 'Hangman', available: true },
    ],
    canSaveTemplate: true,
};

const team = { id: 't1', name: 'Atlas' };

function fakeForm(name: string, onSubmit: () => void): SessionForm {
    return {
        render: (context) => (
            <form
                id={context.formId}
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                <input aria-label={`${name} name`} defaultValue="" />
                <SessionFormFooter context={context} />
            </form>
        ),
    };
}

function open(props: Partial<Parameters<typeof NewSessionDialog>[0]> = {}) {
    renderWithProviders(
        <NewSessionDialog
            trigger={<Button>New session</Button>}
            team={team}
            retro={retroSessionForm(retroProps)}
            {...props}
        />,
    );

    if (props.intent === undefined || props.intent === null) {
        fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    }

    return screen.getByRole('dialog');
}

function shortcutNames(): string[] {
    return within(
        screen.getByRole('radiogroup', { name: 'Retrospective template' }),
    )
        .getAllByRole('radio')
        .map((radio) => radio.dataset.templateId ?? '');
}

function lastPost(): [string, Record<string, unknown>, VisitOptions] {
    return mocks.post.mock.calls[mocks.post.mock.calls.length - 1] as [
        string,
        Record<string, unknown>,
        VisitOptions,
    ];
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.reload.mockReset();
});

describe('NewSessionDialog', () => {
    it('renders nothing when no form is passed', () => {
        const { container } = renderWithProviders(
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
            />,
        );

        expect(container.textContent).toBe('');
    });

    it('offers only the types whose form is passed, with Retrospective first', () => {
        const dialog = open({ whiteboard: fakeForm('Whiteboard', vi.fn()) });
        const types = within(dialog).getByRole('radiogroup', {
            name: 'Session type',
        });

        expect(
            within(types)
                .getAllByRole('radio')
                .map((radio) => radio.dataset.type),
        ).toEqual(['retro', 'whiteboard']);
        expect(
            within(types)
                .getByRole('radio', { name: /Retro/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(within(dialog).getByText('Team Atlas')).toBeTruthy();
    });

    it('offers the five types in the order Retro, Poker, Whiteboard, Poll, Icebreaker', () => {
        const dialog = open({
            icebreaker: fakeForm('Icebreaker', vi.fn()),
            survey: fakeForm('Survey', vi.fn()),
            whiteboard: fakeForm('Whiteboard', vi.fn()),
            poker: fakeForm('Poker', vi.fn()),
        });
        const types = within(dialog).getByRole('radiogroup', {
            name: 'Session type',
        });

        expect(
            within(types)
                .getAllByRole('radio')
                .map((radio) => radio.dataset.type),
        ).toEqual(['retro', 'poker', 'whiteboard', 'survey', 'icebreaker']);
        expect(
            within(types).getByRole('radio', { name: /Poll/ }).textContent,
        ).toContain('Quick vote');
    });

    it('shows the Poll type disabled with the reason it is given', () => {
        const dialog = open({
            survey: surveySessionForm({
                workspaceSlug: 'acme',
                templates: [],
                surveys: [],
                disabledReason: 'You cannot create a survey in this team.',
            }),
        });
        const poll = within(dialog).getByRole('radio', { name: /Poll/ });

        expect(poll.getAttribute('aria-disabled')).toBe('true');
        expect(poll.textContent).toContain(
            'You cannot create a survey in this team.',
        );
    });

    it('shows a type passed with a reason as disabled and never selects it', () => {
        const dialog = open({
            icebreaker: {
                ...fakeForm('Icebreaker', vi.fn()),
                disabledReason: 'This team already has 20 game rooms.',
            },
            intent: null,
        });
        const icebreaker = within(dialog).getByRole('radio', {
            name: /Icebreaker/,
        });

        expect(icebreaker.getAttribute('aria-disabled')).toBe('true');
        expect(icebreaker.textContent).toContain(
            'This team already has 20 game rooms.',
        );

        fireEvent.click(icebreaker);

        expect(icebreaker.getAttribute('aria-checked')).toBe('false');
        expect(
            within(dialog)
                .getByRole('radio', { name: /^Retro/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.queryByLabelText('Icebreaker name')).toBeNull();
    });

    it('stays closed on an intent for a type passed with a reason', () => {
        renderWithProviders(
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
                retro={retroSessionForm(retroProps)}
                icebreaker={{
                    ...fakeForm('Icebreaker', vi.fn()),
                    disabledReason: 'This team already has 20 game rooms.',
                }}
                intent={{ type: 'icebreaker' }}
            />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps what was typed in each type when switching', () => {
        const dialog = open({ poker: fakeForm('Poker', vi.fn()) });

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Sprint 12 retro' },
        });
        fireEvent.click(screen.getByLabelText('Anonymous cards'));
        fireEvent.click(
            within(dialog).getByRole('radio', { name: /Planning poker/ }),
        );

        expect(
            dialog
                .querySelector('[data-session-form="retro"]')
                ?.hasAttribute('hidden'),
        ).toBe(true);

        fireEvent.change(screen.getByLabelText('Poker name'), {
            target: { value: 'Refinement' },
        });
        fireEvent.click(within(dialog).getByRole('radio', { name: /Retro/ }));

        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
            'Sprint 12 retro',
        );
        expect(
            screen
                .getByLabelText('Anonymous cards')
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(
            within(dialog).getByRole('radio', { name: /Planning poker/ }),
        );

        expect(
            (screen.getByLabelText('Poker name') as HTMLInputElement).value,
        ).toBe('Refinement');
    });

    it('submits the form of the active type, and only that one', () => {
        const onPoker = vi.fn();
        const dialog = open({ poker: fakeForm('Poker', onPoker) });
        const submit = (): HTMLButtonElement =>
            within(dialog).getByRole('button', {
                name: 'Create & open',
            }) as HTMLButtonElement;

        expect(dialog.querySelectorAll('button[type="submit"]')).toHaveLength(
            1,
        );
        expect(submit().form?.dataset.slot).toBe('retro-session-fields');

        fireEvent.click(
            within(dialog).getByRole('radio', { name: /Planning poker/ }),
        );

        expect(dialog.querySelectorAll('button[type="submit"]')).toHaveLength(
            1,
        );

        fireEvent.submit(submit().form as HTMLFormElement);

        expect(onPoker).toHaveBeenCalledTimes(1);
        expect(mocks.post).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('radio', { name: /Retro/ }));
        fireEvent.submit(submit().form as HTMLFormElement);

        expect(lastPost()[0]).toContain('/retros');
    });

    it('opens on the type and the template of the intent', () => {
        open({
            poker: fakeForm('Poker', vi.fn()),
            intent: { type: 'retro', template: 'kalm' },
        });

        expect(
            screen
                .getByRole('radio', { name: /KALM/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(shortcutNames()).toEqual([
            'sailboat',
            'start_stop_continue',
            'four_ls',
            'mad_sad_glad',
            'kalm',
        ]);
    });

    it('opens the dialog on `new=session` and on `new=retro`', () => {
        const dialog = (search: string) => (
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
                retro={retroSessionForm(retroProps)}
                poker={fakeForm('Poker', vi.fn())}
                intent={readNewSessionIntent(search)}
            />
        );
        const checkedType = () =>
            Array.from(
                document.querySelectorAll(
                    '[data-slot="session-types"] [role="radio"][aria-checked="true"]',
                ),
            ).map((type) => type.textContent);

        const onSession = renderWithProviders(dialog('?new=session'));

        expect(checkedType()).toHaveLength(1);
        expect(checkedType()[0]).toContain('Retro');

        onSession.unmount();

        const onRetro = renderWithProviders(dialog('?new=retro'));

        expect(checkedType()[0]).toContain('Retro');

        onRetro.unmount();
        renderWithProviders(dialog('?new=poker'));

        expect(checkedType()[0]).toContain('Planning poker');
    });

    it('opens again on a later intent of the page, after it was closed', () => {
        const dialog = (intent: { type: 'retro'; request?: number } | null) => (
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
                retro={retroSessionForm(retroProps)}
                intent={intent}
            />
        );
        const { rerender } = renderWithProviders(dialog(null));

        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(dialog({ type: 'retro', request: 1 }));
        expect(screen.getByRole('dialog')).toBeTruthy();

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(dialog({ type: 'retro', request: 1 }));
        expect(screen.queryByRole('dialog')).toBeNull();

        rerender(dialog({ type: 'retro', request: 2 }));
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('stays closed when the intent names a type that is not offered', () => {
        renderWithProviders(
            <NewSessionDialog
                trigger={<Button>New session</Button>}
                team={team}
                retro={retroSessionForm(retroProps)}
                intent={{ type: 'whiteboard' }}
            />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'New session' }));

        expect(
            within(screen.getByRole('dialog'))
                .getByRole('radio', { name: /Retro/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('closes with Cancel and comes back with fresh defaults', () => {
        open();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Typed' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'New session' }));

        expect(
            (screen.getByLabelText('Name') as HTMLInputElement).value,
        ).toMatch(/^Retro /);
    });
});

describe('the retro form', () => {
    it('lists the five shortcuts in the order of the team, the first one selected', () => {
        open();

        expect(shortcutNames()).toEqual(retroProps.topTemplates);
        expect(
            screen
                .getByRole('radio', { name: /Sailboat/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByText('Columns · 2')).toBeTruthy();
    });

    it("shows a template's whole name on its shortcut", () => {
        open();

        for (const name of ['Start, Stop, Continue', 'Mad, Sad, Glad']) {
            const label = within(
                screen.getByRole('radio', { name: new RegExp(name) }),
            ).getByText(name);

            expect(label.className).toContain('break-words');
            expect(label.className).not.toContain('truncate');
            expect(label.className).not.toContain('line-clamp');
        }
    });

    it('asks for the catalogue when it is not loaded yet', () => {
        open({
            retro: retroSessionForm({ ...retroProps, catalogue: undefined }),
        });

        expect(mocks.reload).toHaveBeenCalledWith({ only: ['catalogue'] });
        expect(screen.getByText('Loading templates…')).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Create & open',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('sends the settings and no columns for an untouched template', () => {
        open();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Sprint 12 retro' },
        });
        fireEvent.click(screen.getByRole('radio', { name: /Start, Stop/ }));
        fireEvent.click(
            screen.getByLabelText('Allow guests without an account'),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        const [url, data] = lastPost();

        expect(url).toContain('/retros');
        expect(data).toEqual({
            title: 'Sprint 12 retro',
            template: 'start_stop_continue',
            is_anonymous: false,
            health_check_enabled: false,
            icebreaker_enabled: false,
            icebreaker_game: 'draw',
            votes_per_participant: null,
            max_votes_per_card: null,
            phase_durations: null,
            guest_access_enabled: true,
        });
    });

    it('sends the columns once one is changed', () => {
        open();

        fireEvent.change(screen.getByLabelText('Column 1 title'), {
            target: { value: 'Tailwind' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add a column' }));
        fireEvent.change(screen.getByLabelText('Column 3 title'), {
            target: { value: 'Island' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1]).toMatchObject({
            template: 'sailboat',
            columns: [
                { title: 'Tailwind', description: null, color: 'moss' },
                { title: 'Anchors', description: null, color: 'coral' },
                { title: 'Island', description: null, color: 'sun' },
            ],
        });
    });

    it('drops the edits when another template is chosen', () => {
        open();

        fireEvent.change(screen.getByLabelText('Column 1 title'), {
            target: { value: 'Tailwind' },
        });
        fireEvent.click(screen.getByRole('radio', { name: /4Ls/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].template).toBe('four_ls');
        expect(lastPost()[1]).not.toHaveProperty('columns');
    });

    it('switches the vote limit from automatic to a stepper', () => {
        open();

        const auto = document.getElementById(
            'new-retro-votes-auto',
        ) as HTMLElement;

        expect(auto.getAttribute('aria-checked')).toBe('true');
        expect(
            screen.getByText('Automatic: number of cards plus 3, at most 10.'),
        ).toBeTruthy();

        fireEvent.click(auto);
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Increase Votes per participant',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].votes_per_participant).toBe(6);
    });

    it('has no limit per card by default, and caps it within the votes per person', () => {
        open();

        const noLimit = document.getElementById(
            'new-retro-max-votes-per-card-auto',
        ) as HTMLElement;

        expect(screen.getByText('Max per card')).toBeTruthy();
        expect(screen.getByText('Votes one person can stack')).toBeTruthy();
        expect(noLimit.getAttribute('aria-checked')).toBe('true');
        expect(noLimit.getAttribute('aria-label')).toBe('No limit per card');

        fireEvent.click(noLimit);
        fireEvent.click(
            screen.getByRole('button', { name: 'Increase Max per card' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].max_votes_per_card).toBe(3);

        fireEvent.click(
            document.getElementById('new-retro-votes-auto') as HTMLElement,
        );

        for (let press = 0; press < 3; press++) {
            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Decrease Votes per participant',
                }),
            );
        }

        expect(
            (
                screen.getByRole('button', {
                    name: 'Increase Max per card',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1]).toMatchObject({
            votes_per_participant: 2,
            max_votes_per_card: 2,
        });

        fireEvent.click(noLimit);
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].max_votes_per_card).toBeNull();
    });

    describe('Timer per phase', () => {
        const choose = async (option: string) => {
            const user = userEvent.setup();

            await user.click(
                screen.getByRole('combobox', { name: 'Timer per phase' }),
            );
            await user.click(screen.getByRole('option', { name: option }));
        };

        it('sits after "Max per card", before the icebreaker, off by default', () => {
            open();

            const labels = Array.from(
                document.querySelectorAll('[data-slot="setting-row"] label'),
            ).map((label) => label.textContent);

            expect(labels.indexOf('Timer per phase')).toBe(
                labels.indexOf('Max per card') + 1,
            );
            expect(labels.indexOf('Icebreaker at the start')).toBe(
                labels.indexOf('Timer per phase') + 1,
            );
            expect(
                screen.getByRole('combobox', { name: 'Timer per phase' })
                    .textContent,
            ).toBe('No timer');
            expect(
                document.getElementById('new-retro-phase-timers-help')
                    ?.textContent,
            ).toBe('Off · Offered to the facilitator, never started by itself');
        });

        it('sends the five standard durations, and null with "No timer"', async () => {
            open();

            await choose('Standard');

            expect(
                document.getElementById('new-retro-phase-timers-help')
                    ?.textContent,
            ).toBe(
                'Writing 7 · Grouping 5 · Voting 3 · Discussing 15 · Actions 5 · Offered to the facilitator, never started by itself',
            );

            fireEvent.click(
                screen.getByRole('button', { name: 'Create & open' }),
            );

            expect(lastPost()[1].phase_durations).toEqual({
                writing: 7,
                grouping: 5,
                voting: 3,
                discussing: 15,
                actions: 5,
            });

            await choose('No timer');
            fireEvent.click(
                screen.getByRole('button', { name: 'Create & open' }),
            );

            expect(lastPost()[1].phase_durations).toBeNull();
        });

        it('sends only the phases a custom set times', async () => {
            open();

            expect(
                document.getElementById('new-retro-phase-writing'),
            ).toBeNull();

            await choose('Custom (5 phases)');

            const presses = {
                Writing: 3,
                Grouping: -5,
                Voting: -3,
                Discussing: -15,
                Actions: -5,
            };

            for (const [phase, count] of Object.entries(presses)) {
                const name =
                    count > 0 ? `Increase ${phase}` : `Decrease ${phase}`;
                const button = screen.getByRole('button', { name });

                for (let press = 0; press < Math.abs(count); press++) {
                    fireEvent.click(button);
                }
            }

            fireEvent.click(
                screen.getByRole('button', { name: 'Create & open' }),
            );

            expect(lastPost()[1].phase_durations).toEqual({ writing: 10 });
        });

        it('shows a refused duration under its row', () => {
            open();

            fireEvent.click(
                screen.getByRole('button', { name: 'Create & open' }),
            );
            act(() =>
                lastPost()[2].onError?.({
                    'phase_durations.writing':
                        'The writing duration must not be greater than 60.',
                }),
            );

            expect(
                document.getElementById('new-retro-phase-timers-error')
                    ?.textContent,
            ).toBe('The writing duration must not be greater than 60.');
        });
    });

    it('shows the error of the cap per card under its row', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));
        act(() =>
            lastPost()[2].onError?.({
                max_votes_per_card:
                    'The max votes per card field must be at least 1.',
            }),
        );

        expect(
            screen.getByText(
                'The max votes per card field must be at least 1.',
            ),
        ).toBeTruthy();
    });

    it('opens the full picker with "Browse" and returns with "Back"', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Browse' }));

        expect(screen.getByLabelText('Search templates')).toBeTruthy();
        expect(screen.getByRole('tab', { name: /My workspace/ })).toBeTruthy();

        fireEvent.click(screen.getByRole('radio', { name: /KALM/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(screen.queryByLabelText('Search templates')).toBeNull();
        expect(shortcutNames()).toContain('kalm');
        expect(screen.getByText('Columns · 4')).toBeTruthy();
    });

    it('shows no template preview in the dialog, and still shows it on the Templates page', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Browse' }));

        expect(screen.getByLabelText('Search templates')).toBeTruthy();
        expect(
            screen.queryByRole('region', { name: 'Template preview' }),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="template-detail"]'),
        ).toBeNull();
    });

    it('names the template and its category above the columns', () => {
        open();

        const line = (): string | undefined =>
            document.querySelector('[data-slot="retro-columns-template"]')
                ?.textContent ?? undefined;

        expect(line()).toBe('Sailboat · Themed & fun');

        fireEvent.change(screen.getByLabelText('Column 1 title'), {
            target: { value: 'Tailwind' },
        });

        expect(line()).toBe('Sailboat · Themed & fun');

        fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
        fireEvent.click(screen.getByRole('radio', { name: /KALM/ }));

        expect(line()).toBe('KALM · Essentials');

        fireEvent.mouseDown(screen.getByRole('tab', { name: /My workspace/ }));
        fireEvent.click(screen.getByRole('radio', { name: /Team pulse/ }));

        expect(line()).toBe('Team pulse · Team & mood');

        fireEvent.click(
            screen.getByRole('radio', { name: /Start from scratch/ }),
        );

        expect(line()).toBeUndefined();
        expect(screen.getByText('Columns · 0')).toBeTruthy();
    });

    it('does not create the retro when Enter is pressed in the template search', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Browse' }));

        const search = screen.getByLabelText('Search templates');

        fireEvent.change(search, { target: { value: 'sail' } });

        expect(fireEvent.keyDown(search, { key: 'Enter' })).toBe(false);
        expect(mocks.post).not.toHaveBeenCalled();
        expect(screen.getByRole('radio', { name: /Sailboat/ })).toBeTruthy();
    });

    it('leaves the AI summary to the session settings', () => {
        open();

        expect(document.getElementById('new-retro-ai-summary')).toBeNull();
        expect(screen.queryByText('Automatic AI summary')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1]).not.toHaveProperty('ai_summary_enabled');
    });

    it('hides "Save as team template" from who may not manage templates', () => {
        open({
            retro: retroSessionForm({ ...retroProps, canSaveTemplate: false }),
        });

        expect(screen.queryByLabelText('Save as team template')).toBeNull();
    });

    it('saves the columns as a template, then creates the retro from it', () => {
        open();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Harbour retro' },
        });
        fireEvent.change(screen.getByLabelText('Column 2 title'), {
            target: { value: 'Rocks' },
        });
        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        const [url, data, options] = lastPost();

        expect(url).toContain('/templates');
        expect(data).toEqual({
            name: 'Harbour retro',
            category: 'themed',
            columns: [
                { title: 'Wind', description: null, color: 'moss' },
                { title: 'Rocks', description: null, color: 'coral' },
            ],
        });
        expect(options.only).toEqual(['catalogue']);

        act(() => {
            options.onSuccess?.({
                props: {
                    catalogue: [
                        template(
                            'workspace:new',
                            'Harbour retro',
                            ['Wind', 'Rocks'],
                            { isWorkspace: true },
                        ),
                        ...catalogue,
                    ],
                },
            });
        });

        expect(mocks.post).toHaveBeenCalledTimes(2);
        expect(lastPost()[0]).toContain('/retros');
        expect(lastPost()[1].template).toBe('workspace:new');
        expect(lastPost()[1]).not.toHaveProperty('columns');
    });

    it('names the template without the space a cut title ends with', () => {
        open();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: `${'a'.repeat(79)} retro of the sprint` },
        });
        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].name).toBe('a'.repeat(79));
    });

    it('creates the retro from the chosen template when the saved one is not found', () => {
        open();

        fireEvent.change(screen.getByLabelText('Column 2 title'), {
            target: { value: 'Rocks' },
        });
        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        act(() => {
            lastPost()[2].onSuccess?.({ props: { catalogue } });
        });

        expect(mocks.post).toHaveBeenCalledTimes(2);
        expect(lastPost()[0]).toContain('/retros');
        expect(lastPost()[1].template).toBe('sailboat');
        expect(lastPost()[1].columns).toEqual([
            { title: 'Wind', description: null, color: 'moss' },
            { title: 'Rocks', description: null, color: 'coral' },
        ]);
    });

    it('shows the refusal of the retro after the template is saved, and does not save it twice', () => {
        open();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Harbour retro' },
        });
        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        act(() => {
            lastPost()[2].onStart?.();
            lastPost()[2].onSuccess?.({
                props: {
                    catalogue: [
                        template(
                            'workspace:new',
                            'Harbour retro',
                            ['Wind', 'Anchors'],
                            { isWorkspace: true },
                        ),
                        ...catalogue,
                    ],
                },
            });
        });
        act(() => {
            lastPost()[2].onStart?.();
            lastPost()[2].onError?.({
                title: 'The title has already been taken.',
            });
            lastPost()[2].onFinish?.();
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'The title has already been taken.',
        );
        expect(
            screen
                .getByLabelText('Save as team template')
                .getAttribute('aria-checked'),
        ).toBe('false');

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(mocks.post).toHaveBeenCalledTimes(3);
        expect(lastPost()[0]).toContain('/retros');
    });

    it('shows the refusal of the template name under the name and creates nothing', () => {
        open();

        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        act(() => {
            lastPost()[2].onStart?.();
            lastPost()[2].onError?.({
                name: 'A template with this name already exists.',
            });
        });

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alert').textContent).toBe(
            'A template with this name already exists.',
        );
        expect(
            (
                screen.getByRole('button', {
                    name: 'Create & open',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('shows any other refusal of the template save under the name', () => {
        open();

        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        act(() => {
            lastPost()[2].onStart?.();
            lastPost()[2].onError?.({
                category: 'The selected category is invalid.',
            });
        });

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('alert').textContent).toBe(
            'The selected category is invalid.',
        );
    });

    it('releases "Create & open" when the template save ends without an answer', () => {
        open();

        fireEvent.click(screen.getByLabelText('Save as team template'));
        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        act(() => {
            lastPost()[2].onStart?.();
            lastPost()[2].onFinish?.();
        });

        expect(
            (
                screen.getByRole('button', {
                    name: 'Create & open',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('cannot save a template without any column', () => {
        open({
            retro: retroSessionForm({
                ...retroProps,
                defaultRetroTemplate: 'custom',
            }),
        });

        expect(
            screen
                .getByLabelText('Save as team template')
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('drops the column errors of the server once the columns change', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        act(() => {
            lastPost()[2].onError?.({
                'columns.1.title': 'The column title is required.',
            });
        });

        expect(
            screen
                .getByLabelText('Column 2 title')
                .getAttribute('aria-invalid'),
        ).toBe('true');

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete column “Wind”' }),
        );

        expect(screen.queryByText('The column title is required.')).toBeNull();
        expect(
            screen
                .getByLabelText('Column 1 title')
                .hasAttribute('aria-invalid'),
        ).toBe(false);
    });

    it('shows the server errors of the retro', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        const options = lastPost()[2];

        act(() => {
            options.onStart?.();
            options.onError?.({
                title: 'The title field is required.',
                'columns.0.title': 'The column title is required.',
            });
            options.onFinish?.();
        });

        expect(
            screen.getAllByRole('alert').map((alert) => alert.textContent),
        ).toEqual([
            'The title field is required.',
            'The column title is required.',
        ]);
    });
});

describe('the retro form of a team with sprints, a default template and facilitators', () => {
    const facilitator = {
        options: [
            { id: 'camille', name: 'Camille Roux', avatarUrl: '' },
            { id: 'ines', name: 'Inès Bernard', avatarUrl: '' },
            { id: 'me', name: 'Mia Lopez', avatarUrl: '' },
        ],
        viewerId: 'me',
        suggestedId: 'camille' as string | null,
        rotation: true,
    };

    const openWith = (props: Partial<RetroSessionFormProps>) =>
        open({ retro: retroSessionForm({ ...retroProps, ...props }) });

    it('names the retro after the sprint of today', () => {
        openWith({ currentSprintNumber: 42 });

        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
            'Sprint 42 retro',
        );
    });

    it('keeps the dated name outside every sprint', () => {
        openWith({ currentSprintNumber: null });

        expect(
            (screen.getByLabelText('Name') as HTMLInputElement).value,
        ).toMatch(/^Retro /);
    });

    it('preselects the team default template ahead of the most used one', () => {
        openWith({ defaultRetroTemplate: 'kalm' });

        expect(
            screen
                .getByRole('radio', { name: /KALM/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('preselects the suggested facilitator and sends them', () => {
        openWith({ facilitator });

        expect(
            screen
                .getByRole('combobox', { name: 'Facilitator' })
                .querySelector('.truncate')?.textContent,
        ).toBe('Camille Roux (suggested)');
        expect(screen.getByText('Suggested by the rotation.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].facilitator_user_id).toBe('camille');
    });

    it('sends no facilitator when the viewer facilitates: the server default', () => {
        openWith({ facilitator: { ...facilitator, suggestedId: null } });

        expect(
            screen
                .getByRole('combobox', { name: 'Facilitator' })
                .querySelector('.truncate')?.textContent,
        ).toBe('Me');

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        expect(lastPost()[1].facilitator_user_id).toBeNull();
    });

    it('preselects the viewer when the suggested person is no longer listed', () => {
        openWith({ facilitator: { ...facilitator, suggestedId: 'gone' } });

        expect(
            screen
                .getByRole('combobox', { name: 'Facilitator' })
                .querySelector('.truncate')?.textContent,
        ).toBe('Me');
        expect(screen.queryByText('Suggested by the rotation.')).toBeNull();
    });

    it('shows a refused facilitator under the select', () => {
        openWith({ facilitator });

        fireEvent.click(screen.getByRole('button', { name: 'Create & open' }));

        const options = lastPost()[2];

        act(() => {
            options.onError?.({
                facilitator_user_id: 'Choose a facilitator from the team.',
            });
            options.onFinish?.();
        });

        expect(
            document.getElementById('new-retro-facilitator-error')?.textContent,
        ).toBe('Choose a facilitator from the team.');
    });
});
