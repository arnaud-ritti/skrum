import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { SprintsCard } from '@/components/team-settings/sprints-card';
import { renderWithProviders } from '@/test/render';
import type { TeamRituals, TeamSprintRow, TeamSprintsPanel } from '@/types';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    toastError: vi.fn(),
    wide: true,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en-GB' } }),
    router: {
        post: mocks.post,
        patch: mocks.patch,
        put: mocks.put,
        delete: mocks.delete,
    },
}));

vi.mock('sonner', () => ({
    toast: { error: mocks.toastError, success: vi.fn() },
}));

vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => mocks.wide }));

function sprint(
    number: number,
    startsOn: string,
    endsOn: string,
    isCurrent = false,
): TeamSprintRow {
    return { id: `s${number}`, number, startsOn, endsOn, isCurrent };
}

const sprint42 = sprint(42, '2026-09-21', '2026-10-04', true);
const sprint41 = sprint(41, '2026-09-07', '2026-09-20');

const current: TeamSprintsPanel = {
    list: [sprint42, sprint41],
    total: 2,
    current: {
        id: 's42',
        number: 42,
        startsOn: '2026-09-21',
        endsOn: '2026-10-04',
    },
    nextRetro: { date: '2026-10-01', time: '14:00' },
    nextStart: {
        number: 43,
        startsOn: '2026-09-30',
        endsOn: '2026-10-13',
        refusal: null,
    },
};

const empty: TeamSprintsPanel = {
    list: [],
    total: 0,
    current: null,
    nextRetro: null,
    nextStart: {
        number: 1,
        startsOn: '2026-09-30',
        endsOn: '2026-10-13',
        refusal: null,
    },
};

const thursdayAtTwo: TeamRituals = {
    sprintLengthWeeks: null,
    retroWeekday: 4,
    retroTime: '14:00',
};

const noRituals: TeamRituals = {
    sprintLengthWeeks: null,
    retroWeekday: null,
    retroTime: null,
};

function card(
    sprints: TeamSprintsPanel = current,
    rituals: TeamRituals = thursdayAtTwo,
) {
    return renderWithProviders(
        <SprintsCard
            workspaceSlug="nordlys"
            team={{ id: 't1', name: 'Atlas' }}
            sprints={sprints}
            rituals={rituals}
        />,
    );
}

function section(): HTMLElement {
    return document.querySelector<HTMLElement>('section#sprints')!;
}

function startButton(): HTMLButtonElement {
    return screen.getByRole<HTMLButtonElement>('button', {
        name: 'Start the next sprint',
    });
}

function described(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

function rows(): string[] {
    return Array.from(
        document.querySelectorAll(
            '[data-test="team-sprints"] [data-sprint-id]',
        ),
    ).map((row) => row.getAttribute('data-sprint-id') ?? '');
}

function preview(): string | null | undefined {
    return document.querySelector('[data-test="next-retro-preview"]')
        ?.textContent;
}

function field(id: string): HTMLInputElement {
    return document.querySelector<HTMLInputElement>(`#${id}`)!;
}

function lastOptions(mock: typeof mocks.post): VisitOptions {
    return mock.mock.calls.at(-1)![2] as VisitOptions;
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0));
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.put.mockReset();
    mocks.delete.mockReset();
    mocks.toastError.mockReset();
    mocks.wide = true;
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SprintsCard', () => {
    it('shows the current sprint highlighted', () => {
        card();

        expect(
            within(section()).getByRole('heading', { name: 'Sprints' }),
        ).not.toBeNull();
        const currentRow = section().querySelector<HTMLElement>(
            '[data-test="current-sprint"]',
        )!;

        expect(currentRow.textContent).toContain('Sprint 42 · 21 Sept → 4 Oct');
        expect(currentRow.textContent).toContain('Current');
    });

    it('says so when no sprint is in progress', () => {
        card(empty, noRituals);

        expect(
            section().querySelector('[data-test="current-sprint"]')
                ?.textContent,
        ).toBe('No sprint in progress.');
        expect(startButton().disabled).toBe(false);
        expect(described(startButton())).toBe(
            'Sprint 1 · from today to 13 Oct',
        );
        expect(document.querySelector('[data-test="team-sprints"]')).toBeNull();
    });

    it('says the same between two sprints, with the next one to start', () => {
        card({
            ...current,
            list: [{ ...sprint42, isCurrent: false }, sprint41],
            current: null,
            nextRetro: null,
        });

        expect(
            section().querySelector('[data-test="current-sprint"]')
                ?.textContent,
        ).toBe('No sprint in progress.');
        expect(described(startButton())).toBe(
            'Sprint 43 · from today to 13 Oct',
        );
    });

    it('starts the next sprint', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        await user.click(startButton());

        expect(mocks.post).toHaveBeenCalledTimes(1);
        expect(mocks.post.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/sprint-starts',
        );
    });

    it('shows a lost race as a toast', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        await user.click(startButton());
        lastOptions(mocks.post).onError?.({
            sprint: 'Sprint 43 already starts today.',
        });

        expect(mocks.toastError).toHaveBeenCalledWith(
            'Sprint 43 already starts today.',
        );
    });

    it('disables the start with its refusal for a planned sprint or one starting today', () => {
        card({
            ...current,
            nextStart: {
                ...current.nextStart,
                refusal: 'Sprint 43 is already planned from 5 Oct.',
            },
        });

        expect(startButton().disabled).toBe(true);
        expect(described(startButton())).toBe(
            'Sprint 43 is already planned from 5 Oct.',
        );
    });

    it('lists the sprints latest first with their days and the current badge', () => {
        card();

        const table = document.querySelector<HTMLElement>(
            'table[data-test="team-sprints"]',
        )!;

        expect(rows()).toEqual(['s42', 's41']);
        expect(
            table.querySelector('[data-sprint-id="s42"]')?.textContent,
        ).toContain('Sprint 42');
        expect(
            table.querySelector('[data-sprint-id="s42"]')?.textContent,
        ).toContain('21 Sept → 4 Oct');
        expect(
            table.querySelector('[data-sprint-id="s42"]')?.textContent,
        ).toContain('Current');
        expect(
            table.querySelector('[data-sprint-id="s41"]')?.textContent,
        ).not.toContain('Current');
    });

    it('shows ten sprints and reveals the rest', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const list = Array.from({ length: 12 }, (_, index) =>
            sprint(
                40 - index,
                `2026-0${(index % 8) + 1}-01`,
                `2026-0${(index % 8) + 1}-10`,
            ),
        );

        card({ ...current, list, total: 12 });

        expect(rows()).toHaveLength(10);

        await user.click(screen.getByRole('button', { name: 'Show all (12)' }));

        expect(rows()).toHaveLength(12);
        expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    });

    it('says how many sprints are listed when the team has more', () => {
        card({ ...current, total: 60 });

        expect(section().textContent).toContain(
            'The 2 latest sprints are listed.',
        );
    });

    it('adds a sprint after the latest one, for the default length', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card(current, { ...thursdayAtTwo, sprintLengthWeeks: 3 });

        await user.click(screen.getByRole('button', { name: 'Add a sprint' }));

        expect(field('sprint-number').value).toBe('43');
        expect(field('sprint-starts-on').value).toBe('2026-10-05');
        expect(field('sprint-ends-on').value).toBe('2026-10-25');

        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/teams/t1/sprints');
        expect(mocks.post.mock.calls[0][1]).toEqual({
            number: 43,
            starts_on: '2026-10-05',
            ends_on: '2026-10-25',
        });
    });

    it('starts the first sprint added by hand today', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card(empty, noRituals);

        await user.click(screen.getByRole('button', { name: 'Add a sprint' }));

        expect(field('sprint-number').value).toBe('1');
        expect(field('sprint-starts-on').value).toBe('2026-09-30');
        expect(field('sprint-ends-on').value).toBe('2026-10-13');
    });

    it('shows an overlap under the first day', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        await user.click(screen.getByRole('button', { name: 'Add a sprint' }));
        await user.click(screen.getByRole('button', { name: 'Add' }));
        lastOptions(mocks.post).onError?.({
            starts_on: 'This sprint overlaps Sprint 42 (21 Sep – 4 Oct).',
        });
        lastOptions(mocks.post).onFinish?.();

        expect(
            await screen.findByText(
                'This sprint overlaps Sprint 42 (21 Sep – 4 Oct).',
            ),
        ).not.toBeNull();
        expect(described(field('sprint-starts-on'))).toBe(
            'This sprint overlaps Sprint 42 (21 Sep – 4 Oct).',
        );
    });

    it('edits a sprint from its row menu', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        const row = document.querySelector<HTMLElement>(
            '[data-sprint-id="s41"]',
        )!;

        await user.click(
            within(row).getByRole('button', { name: 'Sprint actions' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }));

        expect(field('sprint-number').value).toBe('41');
        expect(field('sprint-starts-on').value).toBe('2026-09-07');

        await user.clear(field('sprint-ends-on'));
        await user.type(field('sprint-ends-on'), '2026-09-19');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(mocks.patch.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/sprints/s41',
        );
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            number: 41,
            starts_on: '2026-09-07',
            ends_on: '2026-09-19',
        });
    });

    it('deletes a sprint after its confirmation', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        const row = document.querySelector<HTMLElement>(
            '[data-sprint-id="s41"]',
        )!;

        await user.click(
            within(row).getByRole('button', { name: 'Sprint actions' }),
        );
        await user.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = screen.getByRole('alertdialog', {
            name: 'Delete Sprint 41?',
        });

        expect(dialog.textContent).toContain(
            "Sessions keep their content; they lose this sprint's label.",
        );

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete' }),
        );

        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/sprints/s41',
        );
    });

    it('lists the sprints as cards below 40rem', () => {
        mocks.wide = false;
        card();

        expect(
            document.querySelector('ul[data-test="team-sprints"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('table[data-test="team-sprints"]'),
        ).toBeNull();
        expect(rows()).toEqual(['s42', 's41']);
    });

    it('reads two weeks when no length is set, and the saved rituals', () => {
        card();

        const length = document.querySelector('#sprint-length')!;

        expect(
            within(length as HTMLElement)
                .getByRole('radio', { name: '2 weeks' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            document.querySelector<HTMLSelectElement>(
                'select[name="retro_weekday"]',
            )?.value,
        ).toBe('4');
        expect(field('retro-time').value).toBe('14:00');
        expect(field('retro-time').disabled).toBe(false);
        expect(preview()).toBe('Next retro Thu 1 Oct, 14');
    });

    it('disables the time without a retro day', () => {
        card(current, noRituals);

        expect(field('retro-time').disabled).toBe(true);
    });

    it('updates the next retro preview from the form', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card({
            ...current,
            list: [sprint(43, '2026-10-05', '2026-10-18'), sprint42, sprint41],
        });

        await user.click(screen.getByRole('combobox', { name: 'Retro day' }));
        await user.click(screen.getByRole('option', { name: 'Friday' }));

        expect(preview()).toBe('Next retro Fri 2 Oct, 14');
    });

    it('says when no next retro is left', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card({ ...current, nextRetro: null }, noRituals);

        await user.click(screen.getByRole('combobox', { name: 'Retro day' }));
        await user.click(screen.getByRole('option', { name: 'Monday' }));

        expect(section().textContent).toContain(
            'No next retro until the next sprint is started.',
        );
    });

    it('saves the rituals and shows the errors per field', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        await user.click(screen.getByRole('radio', { name: '3 weeks' }));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(mocks.put.mock.calls[0][0]).toBe('/w/nordlys/teams/t1/rituals');
        expect(mocks.put.mock.calls[0][1]).toEqual({
            sprint_length_weeks: 3,
            retro_weekday: 4,
            retro_time: '14:00',
        });

        lastOptions(mocks.put).onError?.({
            retro_time: 'The retro time field must match the format H:i.',
        });

        expect(
            await screen.findByText(
                'The retro time field must match the format H:i.',
            ),
        ).not.toBeNull();
        expect(field('retro-time').getAttribute('aria-invalid')).toBe('true');
    });

    it('clears the time when the retro day is removed', async () => {
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

        card();

        await user.click(screen.getByRole('combobox', { name: 'Retro day' }));
        await user.click(screen.getByRole('option', { name: 'None' }));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(mocks.put.mock.calls[0][1]).toEqual({
            sprint_length_weeks: 2,
            retro_weekday: null,
            retro_time: null,
        });
    });
});
