import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import { pokerSessionForm } from '@/components/teams/session-create/poker-session-fields';
import type { PokerSessionFormProps } from '@/components/teams/session-create/poker-session-fields';
import { Button } from '@/components/ui/button';
import type { PokerTrackerSourceRow } from '@/lib/poker/types';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    reload: vi.fn(),
    request: vi.fn(),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { post: mocks.post, reload: mocks.reload },
    };
});

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const pokerProps: PokerSessionFormProps = {
    workspaceSlug: 'acme',
    deckOptions: [
        {
            value: 'fibonacci',
            label: 'Fibonacci',
            cards: ['0', '1', '2', '3', '5', '8', '?', '☕'],
        },
        {
            value: 'tshirt',
            label: 'T-shirt sizes',
            cards: ['S', 'M', 'L', '?'],
        },
        { value: 'custom', label: 'Custom', cards: [] },
    ],
    savedDecks: [
        {
            id: 'deck-1',
            name: 'Team scale',
            cards: ['1', '2', '3'],
            scope: 'team',
            canManage: true,
        },
        {
            id: 'deck-2',
            name: 'Hours',
            cards: ['1', '2', '4', '8'],
            scope: 'workspace',
            canManage: true,
        },
    ],
    defaultPokerDeck: { deck: null, savedDeckId: null },
};

const team = { id: 't1', name: 'Atlas' };

function open(
    props: Partial<PokerSessionFormProps> = {},
    intent: Parameters<typeof NewSessionDialog>[0]['intent'] = null,
) {
    renderWithProviders(
        <NewSessionDialog
            trigger={<Button>New session</Button>}
            team={team}
            intent={intent}
            poker={pokerSessionForm({ ...pokerProps, ...props })}
        />,
    );

    if (intent === null) {
        fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    }

    return screen.getByRole('dialog');
}

function deckRadios(): HTMLElement[] {
    return within(
        screen.getByRole('radiogroup', { name: 'Deck' }),
    ).getAllByRole('radio');
}

function checkedDeck(): string | null | undefined {
    return deckRadios()
        .find((radio) => radio.getAttribute('aria-checked') === 'true')
        ?.getAttribute('aria-label');
}

function submit(dialog: HTMLElement): void {
    const button = within(dialog).getByRole('button', {
        name: 'Create & open',
    }) as HTMLButtonElement;

    fireEvent.submit(button.form as HTMLFormElement);
}

function lastPost(): [string, Record<string, unknown>, VisitOptions] {
    return mocks.post.mock.calls[mocks.post.mock.calls.length - 1] as [
        string,
        Record<string, unknown>,
        VisitOptions,
    ];
}

function typeCards(value: string): void {
    fireEvent.change(document.querySelector('#deck-custom-cards') as Element, {
        target: { value },
    });
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
    mocks.request.mockReset();
    mocks.request.mockResolvedValue({ containers: [] });
});

describe('the poker form', () => {
    it('opens with a dated name, the first built-in deck and the settings off', () => {
        const dialog = open();

        expect(
            (screen.getByLabelText('Name') as HTMLInputElement).value,
        ).toMatch(/^Poker /);
        expect(document.querySelector('#new-poker-title')).toBe(
            screen.getByLabelText('Name'),
        );
        expect(
            deckRadios().map((radio) => radio.getAttribute('aria-label')),
        ).toEqual([
            'Fibonacci, 8 cards',
            'T-shirt sizes, 4 cards',
            'Team scale, 3 cards',
            'Hours, 4 cards',
        ]);
        expect(checkedDeck()).toBe('Fibonacci, 8 cards');
        expect(
            within(
                screen.getByRole('radio', { name: 'Hours, 4 cards' }),
            ).getByText('Workspace'),
        ).toBeTruthy();
        expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
        expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();

        for (const id of [
            'new-poker-auto-reveal',
            'new-poker-spectator',
            'new-poker-guests',
        ]) {
            expect(
                document.querySelector(`#${id}`)?.getAttribute('aria-checked'),
            ).toBe('false');
        }

        expect(document.querySelector('#new-poker-anonymous')).toBeNull();
        expect(screen.queryByLabelText('Anonymous votes')).toBeNull();
        expect(
            dialog
                .querySelector('[data-slot="deck-picker"]')
                ?.getAttribute('data-variant'),
        ).toBe('compact');
        expect(
            screen.queryByRole('button', { name: 'Create a deck' }),
        ).toBeNull();

        expect(
            within(dialog)
                .getByRole('tab', { name: 'Later' })
                .getAttribute('aria-selected'),
        ).toBe('true');
    });

    it('preselects the default deck of the team, and the deck of the link before it', () => {
        open({ defaultPokerDeck: { deck: 'tshirt', savedDeckId: 'deck-1' } });

        expect(checkedDeck()).toBe('Team scale, 3 cards');
    });

    it('preselects the deck named by the link', () => {
        open(
            { defaultPokerDeck: { deck: 'tshirt', savedDeckId: null } },
            { type: 'poker', deck: 'deck-2' },
        );

        expect(checkedDeck()).toBe('Hours, 4 cards');
    });

    it('creates the game with a built-in deck and no task', () => {
        const dialog = open();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Refinement' },
        });
        submit(dialog);

        const [url, body] = lastPost();

        expect(url).toContain('/teams/t1/poker-games');
        expect(body).toEqual({
            title: 'Refinement',
            deck: 'fibonacci',
            auto_reveal: false,
            spectator: false,
            task_timer_seconds: null,
            revote_after_reveal: false,
            guest_access_enabled: false,
        });
    });

    it('creates the game with a saved deck, the switches and the typed tasks in order', () => {
        const dialog = open();

        fireEvent.click(screen.getByRole('radio', { name: 'Hours, 4 cards' }));
        fireEvent.click(screen.getByLabelText('Auto reveal'));
        fireEvent.click(screen.getByLabelText('Facilitator in “Watch only”'));
        fireEvent.click(screen.getByLabelText('Anonymous guests allowed'));
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));
        fireEvent.change(screen.getByLabelText('Tasks, one per line'), {
            target: { value: 'Login\n\n Checkout \nSearch' },
        });
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            deck: 'custom',
            saved_deck_id: 'deck-2',
            auto_reveal: true,
            spectator: true,
            guest_access_enabled: true,
            tasks: ['Login', 'Checkout', 'Search'],
        });
        expect(lastPost()[1]).not.toHaveProperty('anonymous_votes');
    });

    it('does not create a game with more than fifty tasks', () => {
        const dialog = open();

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));
        fireEvent.change(screen.getByLabelText('Tasks, one per line'), {
            target: {
                value: Array.from({ length: 51 }, (_, i) => `T${i}`).join('\n'),
            },
        });
        submit(dialog);

        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('uses a deck typed for this game, shown as "This game only"', () => {
        const dialog = open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));

        expect(screen.queryByRole('radiogroup', { name: 'Deck' })).toBeNull();
        expect(document.querySelector('#deck-custom-name')).toBeTruthy();
        expect(
            document
                .querySelector('#deck-custom-unknown')
                ?.getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            document
                .querySelector('#deck-custom-coffee')
                ?.getAttribute('aria-checked'),
        ).toBe('true');

        typeCards('1, 2, 3');
        fireEvent.click(
            document.querySelector('#deck-custom-coffee') as Element,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));

        expect(checkedDeck()).toBe('Custom deck, 4 cards');
        expect(
            within(
                screen.getByRole('radio', { name: 'Custom deck, 4 cards' }),
            ).getByText('This game only'),
        ).toBeTruthy();

        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            deck: 'custom',
            custom_cards: ['1', '2', '3'],
            include_unknown: true,
            include_coffee: false,
        });
        expect(lastPost()[1]).not.toHaveProperty('save_deck_as');
        expect(lastPost()[1]).not.toHaveProperty('saved_deck_id');
    });

    it('saves the typed deck for the team when it has a name', () => {
        const dialog = open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
        fireEvent.change(
            document.querySelector('#deck-custom-name') as Element,
            {
                target: { value: 'Halves' },
            },
        );
        typeCards('1, 2');
        fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));

        expect(checkedDeck()).toBe('Halves, 4 cards');

        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            deck: 'custom',
            custom_cards: ['1', '2'],
            save_deck_as: 'Halves',
        });
    });

    it('takes the deck being typed when the game is created with the editor open', () => {
        const dialog = open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
        typeCards('1, 2, 3, 5, 8');
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            deck: 'custom',
            custom_cards: ['1', '2', '3', '5', '8'],
            include_unknown: true,
            include_coffee: true,
        });
    });

    it('does not create a game from an unfinished deck', () => {
        const dialog = open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
        typeCards('3, 3');

        expect(screen.getByText('Duplicate value: 3')).toBeTruthy();

        submit(dialog);

        expect(mocks.post).not.toHaveBeenCalled();
        expect(
            screen.getByText(
                'This deck needs at least 2 values before the game is created.',
            ),
        ).toBeTruthy();
    });

    it('comes back to the picker with Cancel, the choice unchanged', () => {
        open();

        fireEvent.click(
            screen.getByRole('radio', { name: 'T-shirt sizes, 4 cards' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
        typeCards('1, 2');
        fireEvent.click(
            within(
                document.querySelector(
                    '[data-slot="deck-editor"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Cancel' }),
        );

        expect(checkedDeck()).toBe('T-shirt sizes, 4 cards');
        expect(screen.queryByText('This game only')).toBeNull();
    });

    it('reopens the typed deck from its "Edit" action', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
        typeCards('1, 2');
        fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Custom deck' }),
        );

        expect(screen.getByRole('button', { name: 'Value 1' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Value 2' })).toBeTruthy();
    });

    it('shows the errors of the server where they belong', () => {
        const dialog = open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));
        fireEvent.change(
            document.querySelector('#deck-custom-name') as Element,
            {
                target: { value: 'Team scale' },
            },
        );
        typeCards('1, 2');
        fireEvent.click(screen.getByRole('button', { name: 'Use this deck' }));
        submit(dialog);

        act(() => {
            lastPost()[2].onError?.({
                title: 'The title field is required.',
                save_deck_as: 'A deck with this name already exists.',
                'tasks.0': 'The task is too long.',
            });
        });

        expect(screen.getByText('The title field is required.')).toBeTruthy();
        expect(
            screen.getByText('A deck with this name already exists.'),
        ).toBeTruthy();
        expect(document.querySelector('#deck-custom-name')).toBeTruthy();
        expect(screen.getByText('The task is too long.')).toBeTruthy();
    });

    it('shows the error of a saved deck that is gone under the picker', () => {
        const dialog = open();

        fireEvent.click(
            screen.getByRole('radio', { name: 'Team scale, 3 cards' }),
        );
        submit(dialog);

        act(() => {
            lastPost()[2].onError?.({
                saved_deck_id: 'Choose a saved deck of this team.',
            });
        });

        expect(
            screen.getByText('Choose a saved deck of this team.'),
        ).toBeTruthy();
        expect(screen.getByRole('radiogroup', { name: 'Deck' })).toBeTruthy();
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['pokerDecks'] });
        expect(checkedDeck()).toBe('Fibonacci, 8 cards');
    });

    it('takes the typed deck with Enter in its name, without creating the game', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'New deck' }));

        const name = (): Element =>
            document.querySelector('#deck-custom-name') as Element;

        expect(fireEvent.keyDown(name(), { key: 'Enter' })).toBe(false);
        expect(document.querySelector('#deck-custom-name')).toBeTruthy();

        typeCards('1, 2, 3');

        expect(fireEvent.keyDown(name(), { key: 'Enter' })).toBe(false);
        expect(mocks.post).not.toHaveBeenCalled();
        expect(document.querySelector('#deck-custom-name')).toBeNull();
        expect(checkedDeck()).toMatch(/^Custom deck/);
    });

    it('describes the name by its error only while there is one', () => {
        const dialog = open();
        const title = screen.getByLabelText('Name');

        expect(title.hasAttribute('aria-describedby')).toBe(false);

        submit(dialog);

        act(() => {
            lastPost()[2].onError?.({ title: 'The title is too long.' });
        });

        expect(
            document.getElementById(
                title.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('The title is too long.');
    });

    it('closes the dialog when the game is created', () => {
        const dialog = open();

        submit(dialog);

        act(() => {
            lastPost()[2].onSuccess?.();
        });

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

function trackerSource(
    overrides: Partial<PokerTrackerSourceRow> = {},
): PokerTrackerSourceRow {
    return {
        source: 'jira',
        siteName: 'Acme',
        status: 'active',
        access: 'write',
        canImport: true,
        canWriteBack: true,
        writeBackUnavailableReason: null,
        canSyncStatus: false,
        syncMode: 'off',
        estimateFields: [
            { id: 'customfield_10016', name: 'Story point estimate' },
            { id: 'customfield_10020', name: 'Size' },
        ],
        defaultEstimateFieldId: 'customfield_10016',
        ...overrides,
    };
}

async function choose(name: string, option: string): Promise<void> {
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name }));
    await user.click(screen.getByRole('option', { name: option }));
}

function settingLabels(): (string | null)[] {
    return Array.from(
        document.querySelectorAll('[data-slot="setting-row"] label'),
    ).map((label) => label.textContent);
}

describe('the poker form, the game settings', () => {
    it('lists the settings in the mockup order and sends the timer and the revote switch', async () => {
        const dialog = open({ pokerSources: [trackerSource()] });

        expect(settingLabels()).toEqual([
            'Auto reveal',
            'Facilitator in “Watch only”',
            'Timer per task',
            'Change vote after reveal',
            'Write estimates to Jira',
            'Anonymous guests allowed',
        ]);
        expect(
            document.querySelector('#new-poker-task-timer')?.textContent,
        ).toBe('Off');
        expect(
            document
                .querySelector('#new-poker-revote')
                ?.getAttribute('aria-checked'),
        ).toBe('false');
        expect(
            document.querySelector('#new-poker-write-back')?.textContent,
        ).toBe('Story point estimate');
        expect(within(dialog).getByRole('note').textContent).toBe(
            'Estimates are written to Jira when the facilitator clicks “Save estimate”. Unselected tickets stay in the backlog.',
        );

        await choose('Timer per task', '3 minutes');
        fireEvent.click(screen.getByLabelText('Change vote after reveal'));
        await choose('Write estimates to Jira', 'Size');
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            task_timer_seconds: 180,
            revote_after_reveal: true,
            writes_estimates: true,
            estimate_field_id: 'customfield_10020',
        });
    });

    it('offers each delay of the list', async () => {
        open();

        await userEvent
            .setup()
            .click(screen.getByRole('combobox', { name: 'Timer per task' }));

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Off', '1 minute', '3 minutes', '5 minutes', '10 minutes']);
    });

    it('sends the connection field by default, and nothing with "Don\'t write"', async () => {
        const dialog = open({ pokerSources: [trackerSource()] });

        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            writes_estimates: true,
            estimate_field_id: 'customfield_10016',
        });

        await choose('Write estimates to Jira', "Don't write");
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            writes_estimates: false,
            estimate_field_id: null,
        });
    });

    it('has no write row and no note without a source that can write', () => {
        const dialog = open({
            pokerSources: [
                trackerSource({
                    canWriteBack: false,
                    writeBackUnavailableReason: 'Read-only.',
                }),
            ],
        });

        expect(document.querySelector('#new-poker-write-back')).toBeNull();
        expect(within(dialog).queryByRole('note')).toBeNull();

        submit(dialog);

        expect(lastPost()[1]).not.toHaveProperty('writes_estimates');
        expect(lastPost()[1]).not.toHaveProperty('estimate_field_id');
    });

    it('offers "Write" and "Don\'t write" only for Linear, the first source that can write', async () => {
        const dialog = open({
            pokerSources: [
                trackerSource({ canWriteBack: false }),
                trackerSource({
                    source: 'linear',
                    estimateFields: [],
                    defaultEstimateFieldId: null,
                }),
            ],
        });

        expect(
            screen.getByRole('combobox', { name: 'Write estimates to Linear' })
                .textContent,
        ).toBe('Write');

        await userEvent.setup().click(
            screen.getByRole('combobox', {
                name: 'Write estimates to Linear',
            }),
        );

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(["Don't write", 'Write']);

        await userEvent
            .setup()
            .click(screen.getByRole('option', { name: 'Write' }));
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            writes_estimates: true,
            estimate_field_id: null,
        });
    });

    it('shows the server errors under their rows', () => {
        const dialog = open({ pokerSources: [trackerSource()] });

        submit(dialog);

        act(() => {
            lastPost()[2].onError?.({
                task_timer_seconds: 'The selected task timer is invalid.',
                estimate_field_id: 'The selected field is invalid.',
            });
        });

        expect(
            document.getElementById('new-poker-task-timer-error')?.textContent,
        ).toBe('The selected task timer is invalid.');
        expect(
            document.getElementById('new-poker-write-back-error')?.textContent,
        ).toBe('The selected field is invalid.');
    });
});

async function pickTickets(dialog: HTMLElement, tab: string): Promise<void> {
    mocks.request.mockResolvedValueOnce({
        issues: ['10002', '10001', '10003'].map((externalId) => ({
            externalId,
            key: `PROJ-${externalId.slice(-1)}`,
            title: `Story ${externalId}`,
            assignee: null,
            estimate: null,
            status: null,
            alreadyImported: false,
        })),
        truncated: false,
    });

    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: tab }));
    fireEvent.mouseDown(within(dialog).getByRole('tab', { name: 'Query' }));
    fireEvent.change(
        within(dialog).getByLabelText('Query', { selector: 'textarea' }),
        { target: { value: 'project = PROJ' } },
    );

    await act(async () => {
        fireEvent.click(
            within(dialog).getByRole('button', { name: 'Show issues' }),
        );
    });
}

describe('the poker form, the import tab', () => {
    it('has no import tab without a tracker that can import', () => {
        const dialog = open({
            pokerSources: [trackerSource({ canImport: false })],
        });

        expect(
            within(dialog)
                .getAllByRole('tab')
                .map((tab) => tab.textContent),
        ).toEqual(['Type them', 'Later']);
    });

    it('creates the game with the chosen tickets in the list order, never typed tasks', async () => {
        const dialog = open({
            pokerSources: [trackerSource()],
            initialTasks: 'Typed',
        });

        await pickTickets(dialog, 'Import from Jira');
        fireEvent.click(
            within(dialog).getByRole('checkbox', { name: 'PROJ-1' }),
        );
        submit(dialog);

        expect(lastPost()[0]).toBe('/w/acme/teams/t1/poker-games');
        expect(lastPost()[1]).toMatchObject({
            import_source: 'jira',
            import_ids: ['10002', '10003'],
        });
        expect(lastPost()[1]).not.toHaveProperty('tasks');
    });

    it('imports from the source chosen in the tab, which also takes the estimates', async () => {
        const dialog = open({
            pokerSources: [
                trackerSource(),
                trackerSource({
                    source: 'linear',
                    estimateFields: [],
                    defaultEstimateFieldId: null,
                }),
            ],
        });

        fireEvent.mouseDown(
            within(dialog).getByRole('tab', { name: 'Import from Jira' }),
        );

        const user = userEvent.setup();

        await user.click(screen.getByRole('combobox', { name: 'Source' }));
        await user.click(screen.getByRole('option', { name: 'Linear' }));

        expect(
            screen.getByRole('combobox', { name: 'Write estimates to Linear' }),
        ).toBeTruthy();

        await pickTickets(dialog, 'Import from Linear');
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({
            import_source: 'linear',
            import_ids: ['10002', '10001', '10003'],
            writes_estimates: true,
            estimate_field_id: null,
        });
    });

    it('asks for a ticket before creating a game from an empty import', () => {
        const dialog = open({ pokerSources: [trackerSource()] });

        fireEvent.mouseDown(
            within(dialog).getByRole('tab', { name: 'Import from Jira' }),
        );
        submit(dialog);

        expect(mocks.post).not.toHaveBeenCalled();
        expect(
            document.getElementById('new-poker-import-error')?.textContent,
        ).toBe('Pick at least one ticket, or choose “Later”.');
    });

    it('shows the message of the tracker under the tickets', async () => {
        const dialog = open({ pokerSources: [trackerSource()] });

        await pickTickets(dialog, 'Import from Jira');
        submit(dialog);

        act(() => {
            lastPost()[2].onError?.({
                import_ids: 'Jira did not answer. Try again later.',
            });
        });

        expect(
            document.getElementById('new-poker-import-error')?.textContent,
        ).toBe('Jira did not answer. Try again later.');
    });
});
