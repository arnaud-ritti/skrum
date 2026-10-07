import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MaxPokerTasks,
    PokerTasksField,
    emptyPokerTasks,
    importedTickets,
    taskTitles,
    tasksProblem,
} from '@/components/teams/session-create/poker-tasks-field';
import type { PokerTasksValue } from '@/components/teams/session-create/poker-tasks-field';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const importFrom = {
    workspaceSlug: 'acme',
    teamId: 't1',
    sources: ['jira' as const],
};

function Harness({
    error,
    withSource = false,
}: {
    error?: string;
    withSource?: boolean;
}) {
    const [value, setValue] = useState<PokerTasksValue>(emptyPokerTasks);
    const tickets = importedTickets(value, importFrom.sources);

    return (
        <>
            <PokerTasksField
                value={value}
                onChange={setValue}
                error={error}
                importFrom={withSource ? importFrom : undefined}
            />
            <output data-testid="titles">{taskTitles(value).join('|')}</output>
            <output data-testid="tickets">
                {tickets === null
                    ? ''
                    : `${tickets.source}:${tickets.ids.join('|')}`}
            </output>
        </>
    );
}

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue({ containers: [] });
});

function lines(count: number): string {
    return Array.from(
        { length: count },
        (_, index) => `Task ${index + 1}`,
    ).join('\n');
}

describe('taskTitles', () => {
    it('reads one title per line, trimmed, without the empty lines', () => {
        expect(
            taskTitles({ mode: 'type', text: ' Login \n\n  \nCheckout\n' }),
        ).toEqual(['Login', 'Checkout']);
    });

    it('sends nothing when the tasks come later, whatever was typed', () => {
        expect(taskTitles({ mode: 'later', text: 'Login\nCheckout' })).toEqual(
            [],
        );
    });
});

describe('tasksProblem', () => {
    it('accepts fifty tasks and refuses the fifty-first', () => {
        expect(tasksProblem({ mode: 'type', text: lines(MaxPokerTasks) })).toBe(
            null,
        );
        expect(
            tasksProblem({ mode: 'type', text: lines(MaxPokerTasks + 1) }),
        ).toBe('tooMany');
        expect(
            tasksProblem({ mode: 'later', text: lines(MaxPokerTasks + 1) }),
        ).toBe(null);
    });

    it('refuses a title longer than 200 characters', () => {
        expect(tasksProblem({ mode: 'type', text: 'a'.repeat(200) })).toBe(
            null,
        );
        expect(tasksProblem({ mode: 'type', text: 'a'.repeat(201) })).toBe(
            'tooLong',
        );
    });
});

describe('PokerTasksField', () => {
    it('opens on "Later", with the two tabs of today named by the visible label', () => {
        renderWithProviders(<Harness />);

        expect(
            screen.getByRole('tablist').getAttribute('aria-labelledby'),
        ).toBe(screen.getByText('Tasks').id);

        expect(
            screen.getAllByRole('tab').map((tab) => tab.textContent),
        ).toEqual(['Type them', 'Later']);
        expect(
            screen
                .getByRole('tab', { name: 'Later' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(screen.queryByLabelText('Tasks, one per line')).toBeNull();
        expect(
            screen.getByText(
                'Add the tasks in the room, once the game is open.',
            ),
        ).toBeTruthy();
    });

    it('counts the typed tasks and gives them in order', () => {
        renderWithProviders(<Harness />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));
        fireEvent.change(screen.getByLabelText('Tasks, one per line'), {
            target: { value: 'Login\nCheckout\n\nSearch' },
        });

        expect(screen.getByText('3 / 50 tasks')).toBeTruthy();
        expect(screen.getByTestId('titles').textContent).toBe(
            'Login|Checkout|Search',
        );
    });

    it('keeps the typed lines when going to "Later" and back, and sends none meanwhile', () => {
        renderWithProviders(<Harness />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));
        fireEvent.change(screen.getByLabelText('Tasks, one per line'), {
            target: { value: 'Login' },
        });
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Later' }));

        expect(screen.getByTestId('titles').textContent).toBe('');

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));

        expect(
            (
                screen.getByLabelText(
                    'Tasks, one per line',
                ) as HTMLTextAreaElement
            ).value,
        ).toBe('Login');
    });

    it('says when there are more than fifty tasks', () => {
        renderWithProviders(<Harness />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));

        const field = screen.getByLabelText('Tasks, one per line');

        fireEvent.change(field, { target: { value: lines(51) } });

        expect(screen.getByText('51 / 50 tasks')).toBeTruthy();
        expect(field.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByRole('alert').textContent).toBe(
            'A game starts with 50 tasks at most.',
        );
    });

    it('puts "Import from <source>" first when the team has a tracker, "Later" still chosen', () => {
        renderWithProviders(<Harness withSource />);

        expect(
            screen.getAllByRole('tab').map((tab) => tab.textContent),
        ).toEqual(['Import', 'Type them', 'Later']);
        expect(
            screen
                .getByRole('tab', { name: 'Later' })
                .getAttribute('aria-selected'),
        ).toBe('true');
        expect(screen.getByTestId('tickets').textContent).toBe('');
    });

    it('keeps the chosen tickets when going to another tab and back, and sends them only from the import tab', async () => {
        mocks.request.mockResolvedValueOnce({
            issues: [
                {
                    externalId: '10001',
                    key: 'PROJ-1',
                    title: 'Login',
                    assignee: null,
                    estimate: null,
                    status: null,
                    alreadyImported: false,
                },
            ],
            truncated: false,
        });
        renderWithProviders(<Harness withSource />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Import' }));
        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }));
        fireEvent.change(
            screen.getByLabelText('Query', { selector: 'textarea' }),
            { target: { value: 'project = PROJ' } },
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Show issues' }),
            );
        });

        expect(screen.getByTestId('tickets').textContent).toBe('jira:10001');

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Type them' }));

        expect(screen.getByTestId('tickets').textContent).toBe('');

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Import' }));

        expect(screen.getByTestId('tickets').textContent).toBe('jira:10001');
        expect(
            screen
                .getByRole('checkbox', { name: 'PROJ-1' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('shows the error of the server', () => {
        renderWithProviders(<Harness error="The tasks field is wrong." />);

        expect(screen.getByRole('alert').textContent).toBe(
            'The tasks field is wrong.',
        );
    });
});
