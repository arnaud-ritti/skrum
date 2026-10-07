import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackerIssuePicker } from '@/components/poker/tracker-issue-picker';
import type { TrackerBrowseApi } from '@/lib/poker/tracker-browse';
import type {
    PokerTrackerSource,
    TrackerIssuePreview,
} from '@/lib/poker/types';
import { renderWithProviders } from '@/test/render';

function issue(
    key: string,
    overrides: Partial<TrackerIssuePreview> = {},
): TrackerIssuePreview {
    return {
        externalId: `id-${key}`,
        key,
        title: `Story ${key}`,
        assignee: null,
        estimate: null,
        status: null,
        alreadyImported: false,
        ...overrides,
    };
}

function fakeApi() {
    return {
        containers: vi.fn<TrackerBrowseApi['containers']>(),
        iterations: vi.fn<TrackerBrowseApi['iterations']>(),
        preview: vi.fn<TrackerBrowseApi['preview']>(),
    };
}

let api = fakeApi();

function Harness({
    source = 'jira',
    describeError = () => 'The tracker did not answer.',
}: {
    source?: PokerTrackerSource;
    describeError?: (caught: unknown) => string | null;
}) {
    const [selected, setSelected] = useState<string[]>([]);

    return (
        <>
            <TrackerIssuePicker
                api={api}
                source={source}
                selected={selected}
                onSelectedChange={setSelected}
                describeError={describeError}
            />
            <output data-testid="selected">{selected.join('|')}</output>
        </>
    );
}

function selected(): string {
    return screen.getByTestId('selected').textContent ?? '';
}

async function search(query: string): Promise<void> {
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }), {
        button: 0,
    });
    fireEvent.change(screen.getByLabelText('Query', { selector: 'textarea' }), {
        target: { value: query },
    });

    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Show issues' }));
    });
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    api = fakeApi();
    api.containers.mockResolvedValue({ containers: [] });
    api.iterations.mockResolvedValue([]);
});

describe('TrackerIssuePicker', () => {
    it('lists the tickets of a query, every new one selected, in the source order', async () => {
        api.preview.mockResolvedValueOnce({
            issues: [issue('PROJ-2'), issue('PROJ-1')],
            truncated: false,
        });
        renderWithProviders(<Harness />);

        await search('project = PROJ');

        expect(api.preview).toHaveBeenCalledWith('jira', {
            mode: 'query',
            query: 'project = PROJ',
            container: undefined,
        });
        expect(
            screen
                .getAllByRole('checkbox')
                .map((box) => box.getAttribute('aria-label')),
        ).toEqual(['PROJ-2', 'PROJ-1', 'Select all']);
        expect(selected()).toBe('id-PROJ-2|id-PROJ-1');
        expect(screen.getByText('2 of 2 selected')).toBeTruthy();
    });

    it('writes the JQL of Jira in mono', () => {
        renderWithProviders(<Harness />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }), {
            button: 0,
        });

        expect(
            screen
                .getByLabelText('Query', { selector: 'textarea' })
                .className.includes('font-mono'),
        ).toBe(true);
    });

    it('keeps the selection in the list order when a ticket is ticked again', async () => {
        api.preview.mockResolvedValueOnce({
            issues: [issue('PROJ-1'), issue('PROJ-2'), issue('PROJ-3')],
            truncated: false,
        });
        renderWithProviders(<Harness />);

        await search('login');

        fireEvent.click(screen.getByRole('checkbox', { name: 'PROJ-1' }));

        expect(selected()).toBe('id-PROJ-2|id-PROJ-3');
        expect(screen.getByText('2 of 3 selected')).toBeTruthy();

        fireEvent.click(screen.getByRole('checkbox', { name: 'PROJ-1' }));

        expect(selected()).toBe('id-PROJ-1|id-PROJ-2|id-PROJ-3');
    });

    it('selects all and none, never an imported ticket', async () => {
        api.preview.mockResolvedValueOnce({
            issues: [
                issue('PROJ-1'),
                issue('PROJ-2', { alreadyImported: true }),
            ],
            truncated: false,
        });
        renderWithProviders(<Harness />);

        await search('login');

        expect(screen.getByText('1 of 1 selected')).toBeTruthy();

        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));

        expect(selected()).toBe('');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));

        expect(selected()).toBe('id-PROJ-1');
    });

    it('says when the list is cut and when nothing matches', async () => {
        api.preview.mockResolvedValueOnce({
            issues: [issue('PROJ-1')],
            truncated: true,
        });
        renderWithProviders(<Harness />);

        await search('login');

        expect(
            screen.getByText('Showing the first 100. Narrow the query.'),
        ).toBeTruthy();

        api.preview.mockResolvedValueOnce({ issues: [], truncated: false });

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Show issues' }),
            );
        });

        expect(screen.getByText('No issues found.')).toBeTruthy();
        expect(selected()).toBe('');
    });

    it('shows the message of a failed search and clears the selection', async () => {
        api.preview.mockResolvedValueOnce({
            issues: [issue('PROJ-1')],
            truncated: false,
        });
        renderWithProviders(<Harness />);

        await search('login');

        expect(selected()).toBe('id-PROJ-1');

        api.preview.mockRejectedValueOnce(new Error('boom'));

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Show issues' }),
            );
        });

        expect(screen.getByRole('alert').textContent).toContain(
            'The tracker did not answer.',
        );
        expect(selected()).toBe('');
        expect(screen.queryByRole('checkbox')).toBeNull();
    });

    it('searches the boards of the source once the typing rests', async () => {
        api.containers.mockResolvedValue({
            containers: [{ id: '7', name: 'Sweep scrum board' }],
        });
        vi.useFakeTimers();

        try {
            renderWithProviders(<Harness />);

            await act(async () => {
                vi.advanceTimersByTime(299);
            });

            expect(api.containers).not.toHaveBeenCalled();

            await act(async () => {
                vi.advanceTimersByTime(1);
            });

            expect(api.containers).toHaveBeenCalledExactlyOnceWith(
                'jira',
                '',
                1,
            );

            fireEvent.click(
                screen.getByRole('combobox', { name: 'Choose a board' }),
            );
            fireEvent.change(screen.getByLabelText('Search boards'), {
                target: { value: 'sw' },
            });
            fireEvent.change(screen.getByLabelText('Search boards'), {
                target: { value: 'sweep' },
            });

            await act(async () => {
                vi.advanceTimersByTime(300);
            });

            expect(api.containers).toHaveBeenCalledTimes(2);
            expect(api.containers).toHaveBeenLastCalledWith('jira', 'sweep', 1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('drops the message of a failed board search once a search answers', async () => {
        api.containers.mockRejectedValueOnce(new Error('boom'));
        renderWithProviders(<Harness />);

        expect((await screen.findByRole('alert')).textContent).toContain(
            'The tracker did not answer.',
        );

        api.containers.mockResolvedValueOnce({
            containers: [{ id: '7', name: 'Sweep scrum board' }],
        });
        fireEvent.click(
            screen.getByRole('combobox', { name: 'Choose a board' }),
        );
        fireEvent.change(screen.getByLabelText('Search boards'), {
            target: { value: 'sweep' },
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('TrackerIssuePicker, a GitHub query', () => {
    async function chooseRepository(name: string): Promise<void> {
        await userEvent.click(
            screen.getByRole('combobox', { name: 'Choose a repository' }),
        );
        await userEvent.click(
            within(screen.getByRole('listbox')).getByRole('option', { name }),
        );
    }

    it('asks for no milestone when a repository is chosen for a query', async () => {
        api.containers.mockResolvedValue({
            containers: [{ id: 'acme/web', name: 'acme/web' }],
        });
        renderWithProviders(<Harness source="github" />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }), {
            button: 0,
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });
        await chooseRepository('acme/web');

        expect(api.iterations).not.toHaveBeenCalled();
    });

    it('keeps the chosen repository shown when another search leaves it out', async () => {
        api.containers.mockResolvedValueOnce({
            containers: [{ id: 'acme/web', name: 'acme/web' }],
        });
        renderWithProviders(<Harness source="github" />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }), {
            button: 0,
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });
        await chooseRepository('acme/web');

        api.containers.mockResolvedValueOnce({
            containers: [{ id: 'acme/api', name: 'acme/api' }],
        });
        fireEvent.click(
            screen.getByRole('combobox', { name: 'Choose a repository' }),
        );
        fireEvent.change(screen.getByLabelText('Search repositories'), {
            target: { value: 'api' },
        });

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        expect(
            screen.getByRole('combobox', { name: 'Choose a repository' })
                .textContent,
        ).toBe('acme/web');
    });
});
