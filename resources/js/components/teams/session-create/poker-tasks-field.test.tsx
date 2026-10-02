import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
    MaxPokerTasks,
    PokerTasksField,
    emptyPokerTasks,
    taskTitles,
    tasksProblem,
} from '@/components/teams/session-create/poker-tasks-field';
import type { PokerTasksValue } from '@/components/teams/session-create/poker-tasks-field';
import { renderWithProviders } from '@/test/render';

function Harness({ error }: { error?: string }) {
    const [value, setValue] = useState<PokerTasksValue>(emptyPokerTasks);

    return (
        <>
            <PokerTasksField value={value} onChange={setValue} error={error} />
            <output data-testid="titles">{taskTitles(value).join('|')}</output>
        </>
    );
}

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
    it('opens on "Later", with the two tabs of today', () => {
        renderWithProviders(<Harness />);

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

    it('shows the error of the server', () => {
        renderWithProviders(<Harness error="The tasks field is wrong." />);

        expect(screen.getByRole('alert').textContent).toBe(
            'The tasks field is wrong.',
        );
    });
});
