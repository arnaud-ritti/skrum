import { act, fireEvent, screen, within } from '@testing-library/react';
import { toast } from 'sonner';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { ImportTasksDialog } from '@/components/poker/import-tasks-dialog';
import type { GameContextValue } from '@/components/poker/game-context';
import type {
    PokerTrackerSource,
    TrackerIssuePreview,
} from '@/lib/poker/types';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

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

function open(
    sources: PokerTrackerSource[] = ['jira'],
    overrides: Partial<GameContextValue> = {},
) {
    const onOpenChange = vi.fn();
    const harness = renderInRoom(
        <ImportTasksDialog
            open
            onOpenChange={onOpenChange}
            sources={sources}
        />,
        pokerSnapshot(),
        overrides,
    );

    return { ...harness, onOpenChange };
}

function dialog(): HTMLElement {
    return screen.getByRole('dialog');
}

function button(name: string | RegExp): HTMLButtonElement {
    return within(dialog()).getByRole<HTMLButtonElement>('button', { name });
}

function checkbox(name: string): HTMLButtonElement {
    return within(dialog()).getByRole<HTMLButtonElement>('checkbox', { name });
}

function urls(): string[] {
    return mocks.request.mock.calls.map((call) => call[0].url as string);
}

function toQueryMode(): void {
    fireEvent.mouseDown(within(dialog()).getByRole('tab', { name: 'Query' }), {
        button: 0,
    });
}

async function showIssuesFor(query: string): Promise<void> {
    toQueryMode();
    fireEvent.change(
        within(dialog()).getByLabelText('Query', { selector: 'textarea' }),
        {
            target: { value: query },
        },
    );

    await act(async () => {
        fireEvent.click(button('Show issues'));
    });
}

beforeAll(() => {
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue({
        containers: [],
        issues: [],
        truncated: false,
        statuses: [],
    });
    vi.mocked(toast.success).mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('ImportTasksDialog, the sources', () => {
    it('renders nothing of the form while it is closed', () => {
        renderInRoom(
            <ImportTasksDialog
                open={false}
                onOpenChange={() => {}}
                sources={['jira']}
            />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('has no source choice when one tracker is connected', () => {
        open(['jira']);

        expect(within(dialog()).getByText('Import tasks')).toBeTruthy();
        expect(dialog().querySelector('[aria-label="Source"]')).toBeNull();
        expect(
            dialog().querySelector('[aria-label="Import from Jira"]'),
        ).not.toBeNull();
        expect(
            dialog().querySelector('[aria-label="Choose a board"]'),
        ).not.toBeNull();
        expect(
            dialog()
                .querySelector('[aria-label="Choose a sprint"]')
                ?.hasAttribute('disabled'),
        ).toBe(true);
    });

    it('names the board and the sprint the way the chosen tracker does', () => {
        open(['jira', 'linear', 'github']);

        const sources = dialog().querySelector<HTMLElement>(
            '[aria-label="Source"]',
        );

        expect(sources).not.toBeNull();
        expect(
            within(sources as HTMLElement)
                .getAllByRole('radio')
                .map((item) => item.textContent),
        ).toEqual(['Jira', 'Linear', 'GitHub']);
        expect(
            within(sources as HTMLElement)
                .getByRole('radio', { name: 'GitHub' })
                .querySelector('[data-provider-mark="github"]'),
        ).not.toBeNull();

        fireEvent.click(
            within(sources as HTMLElement).getByRole('radio', {
                name: 'Linear',
            }),
        );

        expect(
            dialog().querySelector('[aria-label="Import from Linear"]'),
        ).not.toBeNull();
        expect(
            dialog().querySelector('[aria-label="Choose a team"]'),
        ).not.toBeNull();
        expect(
            dialog().querySelector('[aria-label="Choose a cycle"]'),
        ).not.toBeNull();

        fireEvent.click(
            within(sources as HTMLElement).getByRole('radio', {
                name: 'GitHub',
            }),
        );
        toQueryMode();

        expect(
            dialog().querySelector('[aria-label="Choose a repository"]'),
        ).not.toBeNull();
        expect(button('Show issues').disabled).toBe(false);
    });
});

describe('ImportTasksDialog, the search of a board', () => {
    it('waits 300 ms after the last key before asking the tracker', async () => {
        vi.useFakeTimers();
        open(['jira']);

        await act(async () => {
            vi.advanceTimersByTime(299);
        });

        expect(mocks.request).not.toHaveBeenCalled();

        fireEvent.click(
            within(dialog()).getByRole('combobox', { name: 'Choose a board' }),
        );
        fireEvent.change(screen.getByLabelText('Search boards'), {
            target: { value: 'web' },
        });

        await act(async () => {
            vi.advanceTimersByTime(299);
        });

        expect(mocks.request).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(1);
        });

        expect(urls()).toHaveLength(1);
        expect(urls()[0]).toContain('/poker/game-1/imports/jira/containers');
        expect(urls()[0]).toContain('q=web');
    });

    it('shows all Linear team issues without requiring a cycle', async () => {
        vi.useFakeTimers();
        mocks.request.mockResolvedValueOnce({
            containers: [{ id: 'team-1', name: 'Product' }],
        });
        open(['linear']);

        fireEvent.click(
            within(dialog()).getByRole('combobox', { name: 'Choose a team' }),
        );
        expect(screen.getByLabelText('Search teams')).toBeTruthy();
        await act(async () => {
            vi.advanceTimersByTime(300);
        });
        mocks.request.mockResolvedValueOnce([]);
        await act(async () => {
            fireEvent.click(screen.getByRole('option', { name: 'Product' }));
        });

        expect(
            within(dialog()).getByRole('combobox', { name: 'Choose a team' })
                .textContent,
        ).toContain('Product');
        expect(urls()[1]).toContain('container=team-1');
        expect(
            within(dialog())
                .getByRole('combobox', { name: 'Choose a cycle' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect((button('Show issues') as HTMLButtonElement).disabled).toBe(
            false,
        );
        mocks.request.mockResolvedValueOnce({
            issues: [
                {
                    externalId: 'uuid-1',
                    key: 'ENG-1',
                    title: 'Team issue',
                    alreadyImported: false,
                },
            ],
            truncated: false,
        });
        await act(async () => {
            fireEvent.click(button('Show issues'));
        });
        expect(within(dialog()).getByText('Team issue')).toBeTruthy();
        expect(mocks.request.mock.calls.at(-1)?.[1]).toEqual({
            mode: 'iteration',
            iteration_id: '',
            container: 'team-1',
            browse: true,
        });
    });

    it('does not search boards in query mode, except on GitHub', async () => {
        vi.useFakeTimers();
        open(['jira']);
        toQueryMode();

        await act(async () => {
            vi.advanceTimersByTime(600);
        });

        expect(
            urls().filter((url) => url.includes('/containers')),
        ).toHaveLength(0);
    });
});

describe('ImportTasksDialog, the issues', () => {
    it('caps the import selection at the remaining room capacity', async () => {
        mocks.request.mockResolvedValue({
            containers: [],
            issues: [issue('A'), issue('B'), issue('C')],
            truncated: false,
        });
        renderInRoom(
            <ImportTasksDialog
                open
                onOpenChange={() => {}}
                sources={['jira']}
            />,
            pokerSnapshot({
                tasks: Array.from({ length: 198 }, (_, index) =>
                    pokerTask(`task-${index}`, 'Existing task'),
                ),
            }),
        );
        await showIssuesFor('tasks');
        expect(button('Import 2 tasks').disabled).toBe(false);
        expect(checkbox('C').disabled).toBe(true);
    });

    it('shows the issues of a query, the new ones ticked, the imported ones locked', async () => {
        open(['jira']);
        mocks.request.mockResolvedValueOnce({
            issues: [
                issue('PROJ-1', { assignee: 'Jane Doe', estimate: '3' }),
                issue('PROJ-2', { alreadyImported: true }),
            ],
            truncated: true,
        });

        expect(button('Import 0 tasks').disabled).toBe(true);

        await showIssuesFor('login');

        expect(urls()[0]).toBe('/poker/game-1/imports/jira/preview');
        expect(mocks.request.mock.calls[0][1]).toEqual({
            mode: 'query',
            query: 'login',
            browse: true,
        });
        expect(checkbox('PROJ-1').getAttribute('aria-checked')).toBe('true');
        expect(checkbox('PROJ-2').getAttribute('aria-checked')).toBe('true');
        expect(checkbox('PROJ-2').disabled).toBe(true);
        expect(within(dialog()).getByText('Story PROJ-1')).toBeTruthy();
        expect(within(dialog()).getByText('Jane Doe')).toBeTruthy();
        expect(
            within(dialog())
                .getAllByRole('listitem')
                .filter((item) =>
                    item.textContent?.includes('Already imported'),
                ),
        ).toHaveLength(1);
        expect(
            within(dialog()).getByText(
                'Showing the first 100. Narrow the query.',
            ),
        ).toBeTruthy();
        expect(button('Import 1 task').disabled).toBe(false);
    });

    it('imports the ticked issues, says how many, reads the game again and closes', async () => {
        const { ctx, onOpenChange } = open(['jira']);
        mocks.request.mockResolvedValueOnce({
            issues: [issue('PROJ-1'), issue('PROJ-2'), issue('PROJ-3')],
            truncated: false,
        });

        await showIssuesFor('login');

        fireEvent.click(checkbox('PROJ-2'));

        expect(checkbox('PROJ-2').getAttribute('aria-checked')).toBe('false');

        mocks.request.mockResolvedValueOnce({ imported: 2, skipped: 0 });

        await act(async () => {
            fireEvent.click(button('Import 2 tasks'));
        });

        expect(urls()[1]).toBe('/poker/game-1/imports/jira');
        expect(mocks.request.mock.calls[1][1]).toEqual({
            external_ids: ['id-PROJ-1', 'id-PROJ-3'],
        });
        expect(toast.success).toHaveBeenCalledWith('2 imported, 0 skipped.');
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('keeps Import and Cancel off until the imported tasks are loaded', async () => {
        const refetch = vi.fn(() => new Promise<void>(() => undefined));
        const { onOpenChange } = open(['jira'], { refetch });
        mocks.request.mockResolvedValueOnce({
            issues: [issue('PROJ-1')],
            truncated: false,
        });

        await showIssuesFor('login');

        mocks.request.mockResolvedValueOnce({ imported: 1, skipped: 0 });

        await act(async () => {
            fireEvent.click(button('Import 1 task'));
        });

        expect(refetch).toHaveBeenCalledTimes(1);
        expect(button('Import 1 task').disabled).toBe(true);
        expect(button('Cancel').disabled).toBe(true);

        fireEvent.keyDown(dialog(), { key: 'Escape' });

        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('stays open when the import is refused', async () => {
        const { ctx, onOpenChange } = open(['jira']);
        mocks.request.mockResolvedValueOnce({
            issues: [issue('PROJ-1')],
            truncated: false,
        });

        await showIssuesFor('login');

        mocks.request.mockResolvedValueOnce(undefined);

        await act(async () => {
            fireEvent.click(button('Import 1 task'));
        });

        expect(toast.success).not.toHaveBeenCalled();
        expect(ctx.refetch).not.toHaveBeenCalled();
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(button('Import 1 task').disabled).toBe(false);
    });

    it('ticks and unticks every new issue at once', async () => {
        open(['jira']);
        mocks.request.mockResolvedValueOnce({
            issues: [
                issue('PROJ-1'),
                issue('PROJ-2'),
                issue('PROJ-3', { alreadyImported: true }),
            ],
            truncated: false,
        });

        await showIssuesFor('login');

        fireEvent.click(checkbox('Select all'));

        expect(button('Import 0 tasks').disabled).toBe(true);
        expect(checkbox('PROJ-3').getAttribute('aria-checked')).toBe('true');

        fireEvent.click(checkbox('Select all'));

        expect(button('Import 2 tasks').disabled).toBe(false);
    });

    it('says so when the tracker finds nothing', async () => {
        open(['jira']);
        mocks.request.mockResolvedValueOnce({ issues: [], truncated: false });

        await showIssuesFor('nothing');

        expect(within(dialog()).getByText('No issues found.')).toBeTruthy();
        expect(within(dialog()).queryByRole('checkbox')).toBeNull();
    });

    it('drops the answer of a query that was changed meanwhile', async () => {
        open(['jira']);
        let answer: (value: unknown) => void = () => {};
        mocks.request.mockReturnValueOnce(
            new Promise((resolve) => {
                answer = resolve;
            }),
        );

        toQueryMode();
        fireEvent.change(
            within(dialog()).getByLabelText('Query', { selector: 'textarea' }),
            {
                target: { value: 'login' },
            },
        );
        fireEvent.click(button('Show issues'));

        expect(button('Loading…').disabled).toBe(true);

        fireEvent.change(
            within(dialog()).getByLabelText('Query', { selector: 'textarea' }),
            {
                target: { value: 'logout' },
            },
        );

        await act(async () => {
            answer({ issues: [issue('PROJ-1')], truncated: false });
        });

        expect(within(dialog()).queryByRole('checkbox')).toBeNull();
        expect(button('Show issues').disabled).toBe(false);
    });

    it('shows the message of the tracker when the search fails', async () => {
        open(['jira'], { handleError: () => 'Jira did not answer.' });
        mocks.request.mockRejectedValueOnce(new Error('boom'));

        await showIssuesFor('login');

        expect(within(dialog()).getByRole('alert').textContent).toContain(
            'Jira did not answer.',
        );
        expect(within(dialog()).queryByRole('checkbox')).toBeNull();
    });

    it('closes on Cancel', () => {
        const { onOpenChange } = open(['jira']);

        fireEvent.click(button('Cancel'));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
