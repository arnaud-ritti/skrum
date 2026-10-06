import {
    act,
    fireEvent,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesPage } from '@/components/workspaces/templates-page';
import type { TemplatesPageProps } from '@/components/workspaces/templates-page';
import { renderWithProviders } from '@/test/render';
import type { CatalogueTemplate } from '@/types';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    visit: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        currentTeam: { id: 'team-1', name: 'Atlas', membersCount: 3 } as {
            id: string;
            name: string;
            membersCount: number;
        } | null,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: mocks.props }),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string | { url: string };
        children: ReactNode;
    }) => (
        <a href={typeof href === 'string' ? href : href.url} {...props}>
            {children}
        </a>
    ),
    router: {
        post: mocks.post,
        patch: mocks.patch,
        delete: mocks.delete,
        reload: mocks.reload,
        visit: mocks.visit,
    },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const catalogue: CatalogueTemplate[] = [
    {
        key: 'start_stop_continue',
        name: 'Start, Stop, Continue',
        category: 'essentials',
        isCommon: true,
        isWorkspace: false,
        columns: [
            { title: 'Start', description: null, color: 'moss' },
            { title: 'Stop', description: null, color: 'coral' },
        ],
    },
    {
        key: 'custom',
        name: 'Custom',
        category: null,
        isCommon: false,
        isWorkspace: false,
        columns: [],
    },
];

const base: TemplatesPageProps = {
    workspace: { id: 'w1', name: 'Nordlys', slug: 'nordlys' },
    templates: [
        {
            id: 'template-1',
            name: 'Team pulse',
            category: 'team_mood',
            author: { name: 'Ada Lovelace', avatarUrl: '' },
            usageCount: 3,
            visibility: 'workspace',
            team: null,
            canManage: false,
            columns: [
                { title: 'Energy', description: null, color: 'moss' },
                { title: 'Blockers', description: null, color: 'coral' },
            ],
        },
    ],
    categories: [
        { value: 'essentials', label: 'Essentials' },
        { value: 'team_mood', label: 'Team & mood' },
    ],
    whiteboardTemplates: [],
    pokerDecks: [
        {
            id: 'deck-1',
            name: 'Fibonacci + coffee',
            cards: ['1', '2', '3', '?'],
            usageCount: 1,
            author: null,
            canManage: false,
        },
    ],
    canCreatePokerDeck: false,
    canCreate: true,
    canShareWorkspace: false,
    teamTemplateTeams: [],
};

const manager: Partial<TemplatesPageProps> = {
    canShareWorkspace: true,
    templates: base.templates.map((template) => ({
        ...template,
        canManage: true,
    })),
};

function page(overrides: Partial<Parameters<typeof TemplatesPage>[0]> = {}) {
    return renderWithProviders(<TemplatesPage {...base} {...overrides} />);
}

/** With a single kind to create, the button opens the retro editor itself: there is no menu. */
async function newTemplate(kind: 'Retro template' | 'Poker deck') {
    await userEvent.click(screen.getByRole('button', { name: 'New template' }));

    const entry = screen.queryByRole('menuitem', { name: kind });

    if (entry !== null) {
        await userEvent.click(entry);
    }
}

function query(href: string | null): URLSearchParams {
    return new URL(href ?? '', 'http://localhost').searchParams;
}

beforeEach(() => {
    for (const mock of [
        mocks.post,
        mocks.patch,
        mocks.delete,
        mocks.reload,
        mocks.visit,
    ]) {
        mock.mockReset();
    }

    mocks.props.currentTeam = { id: 'team-1', name: 'Atlas', membersCount: 3 };
});

describe('TemplatesPage', () => {
    it('opens on "All": the three kinds one under the other, with the counts in the tabs', () => {
        page();

        expect(
            screen.getByRole('heading', { level: 1, name: 'Templates' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Templates shared by every team of this workspace',
            ),
        ).toBeTruthy();
        expect(
            screen.getAllByRole('tab').map((tab) => tab.textContent),
        ).toEqual(['All', 'Retro · 1', 'Poker · 1', 'Whiteboard · 0']);
        expect(
            screen
                .getAllByRole('heading', { level: 2 })
                .map((heading) => heading.textContent),
        ).toEqual(['Retrospective', 'Planning poker', 'Whiteboard']);
        expect(screen.getByText('Deck values')).toBeTruthy();
        expect(screen.getByText('No whiteboard templates yet.')).toBeTruthy();
        expect(
            screen.getByText(
                'Save any whiteboard as a template from its menu — every team of Nordlys will be able to start from it.',
            ),
        ).toBeTruthy();
        expect(mocks.reload).not.toHaveBeenCalled();
    });

    it('shows a retro template as a card that opens the session dialog of the current team', () => {
        page();

        const card = screen.getByRole('article', { name: 'Team pulse' });

        expect(within(card).getByText('2 columns · used 3×')).toBeTruthy();
        expect(within(card).getByText('By Ada Lovelace')).toBeTruthy();
        expect(within(card).getByText('Energy')).toBeTruthy();

        const href = within(card)
            .getByRole('link', { name: 'Use Team pulse' })
            .getAttribute('href');

        expect(href).toContain('/w/nordlys/teams/team-1?');
        expect(query(href).get('new')).toBe('retro');
        expect(query(href).get('template')).toBe('workspace:template-1');
    });

    it('opens the poker form on a deck of the workspace', () => {
        page();

        const card = screen.getByRole('article', {
            name: 'Fibonacci + coffee',
        });
        const href = within(card)
            .getByRole('link', { name: 'Use Fibonacci + coffee' })
            .getAttribute('href');

        expect(within(card).getByText('1 game')).toBeTruthy();
        expect(query(href).get('new')).toBe('poker');
        expect(query(href).get('deck')).toBe('deck-1');
    });

    it('gives a member no control over the templates they may not edit', () => {
        page();

        expect(
            screen.queryByRole('button', { name: /^Actions for/ }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Create a deck' }),
        ).toBeNull();
    });

    it('disables "Use" with its hint when the user has no team', () => {
        mocks.props.currentTeam = null;
        page();

        const use = screen.getByRole('button', { name: 'Use Team pulse' });

        expect(use.getAttribute('aria-disabled')).toBe('true');
        expect(screen.queryByRole('link', { name: /^Use / })).toBeNull();
        expect(screen.getAllByText('Pick a team first').length).toBeGreaterThan(
            0,
        );
    });

    it('filters the three kinds with one search and says when nothing matches', async () => {
        page();

        const search = screen.getByRole('searchbox', {
            name: 'Search templates',
        });

        await userEvent.type(search, 'fibo');

        expect(
            screen.queryByRole('article', { name: 'Team pulse' }),
        ).toBeNull();
        expect(
            screen.getByRole('article', { name: 'Fibonacci + coffee' }),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('heading', { level: 2 })
                .map((heading) => heading.textContent),
        ).toEqual(['Planning poker']);

        await userEvent.type(search, 'zzz');

        expect(screen.getByText('No template matches "fibozzz"')).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Clear search' }),
        );

        expect(
            screen.getByRole('article', { name: 'Team pulse' }),
        ).toBeTruthy();
    });

    it('shows one kind per tab', async () => {
        page();

        await userEvent.click(screen.getByRole('tab', { name: 'Poker · 1' }));

        expect(
            screen
                .getAllByRole('heading', { level: 2 })
                .map((heading) => heading.textContent),
        ).toEqual(['Planning poker']);

        await userEvent.click(
            screen.getByRole('tab', { name: 'Whiteboard · 0' }),
        );

        expect(screen.getByText('No whiteboard templates yet.')).toBeTruthy();
        expect(screen.queryByRole('article')).toBeNull();
    });

    it('asks for the catalogue on the Retro tab and shows the full picker, built-in templates first, which a member may duplicate', async () => {
        const view = page();

        await userEvent.click(screen.getByRole('tab', { name: 'Retro · 1' }));

        expect(mocks.reload.mock.calls[0][0]).toMatchObject({
            only: ['catalogue'],
        });
        expect(screen.getAllByRole('searchbox')).toHaveLength(1);

        view.rerender(<TemplatesPage {...base} catalogue={catalogue} />);

        expect(
            screen.getByRole('radio', { name: 'Start, Stop, Continue' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Use this template' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Duplicate and edit' }),
        ).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Use this template' }),
        );

        expect(query(mocks.visit.mock.calls[0][0]).get('template')).toBe(
            'start_stop_continue',
        );
    });

    it('says when the catalogue could not be loaded, and asks again', async () => {
        page();

        await userEvent.click(screen.getByRole('tab', { name: 'Retro · 1' }));
        await act(async () => {
            mocks.reload.mock.calls[0][0].onFinish?.();
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'Could not load the templates.',
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Try again' }),
        );

        expect(mocks.reload).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('gives the focus back to the Edit button of the picker when its editor closes', async () => {
        page({ ...manager, catalogue, initialTab: 'retro' });

        await userEvent.click(
            screen.getByRole('tab', { name: /My workspace/ }),
        );
        await userEvent.click(
            screen.getByRole('radio', { name: /Team pulse/ }),
        );

        const edit = screen.getByRole('button', { name: 'Edit' });

        await userEvent.click(edit);
        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(document.activeElement).toBe(edit));
    });

    it('lets a manager duplicate a built-in template from the picker into a new template', async () => {
        page({ ...manager, catalogue, initialTab: 'retro' });

        await userEvent.click(
            screen.getByRole('button', { name: 'Duplicate and edit' }),
        );

        const dialog = screen.getByRole('dialog');
        const name = dialog.querySelector<HTMLInputElement>('#template-name');

        expect(name?.value).toBe('Copy of Start, Stop, Continue');
        expect(
            within(dialog).queryByRole('button', { name: 'Delete template' }),
        ).toBeNull();
    });

    it('opens the editor on a new template for a manager', async () => {
        page({ ...manager, catalogue });

        await newTemplate('Retro template');

        const dialog = screen.getByRole('dialog');

        expect(dialog.querySelector('#template-name')).toBeTruthy();
        expect(dialog.querySelector('#template-source')).toBeTruthy();
        expect(dialog.querySelector('#template-category')).toBeTruthy();
    });

    it('deletes a template from the menu of its card, after the confirmation', async () => {
        page({ ...manager });

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for Team pulse' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const dialog = screen.getByRole('alertdialog');

        expect(
            within(dialog).getByText(
                'Retros already created from it are not affected.',
            ),
        ).toBeTruthy();
        expect(mocks.delete).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete template' }),
        );

        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/templates/template-1',
        );

        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onSuccess?.();
        });

        expect(screen.queryByRole('alertdialog')).toBeNull();
        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('heading', { name: 'Retrospective' }),
            ),
        );
    });

    it('returns the focus to the menu of the card when the deletion is cancelled', async () => {
        page({ ...manager });

        const menu = screen.getByRole('button', {
            name: 'Actions for Team pulse',
        });

        await userEvent.click(menu);
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Cancel',
            }),
        );

        await waitFor(() =>
            expect(screen.queryByRole('alertdialog')).toBeNull(),
        );
        await waitFor(() => expect(document.activeElement).toBe(menu));
    });

    it('opens the editor on a template from the menu of its card', async () => {
        page({ ...manager });

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for Team pulse' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        const dialog = screen.getByRole('dialog');

        expect(
            dialog.querySelector<HTMLInputElement>('#template-name')?.value,
        ).toBe('Team pulse');
        expect(
            within(dialog).getByRole('button', { name: 'Delete template' }),
        ).toBeTruthy();
        expect(mocks.reload).not.toHaveBeenCalled();
    });

    it('offers a manager to create the first template from the empty state', () => {
        page({ ...manager, templates: [] });

        expect(screen.getByText('No workspace templates yet.')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Create a template' }),
        ).toBeTruthy();
    });

    it('shows the visibility of each template beside its name', () => {
        page({
            templates: [
                { ...base.templates[0], id: 't-w', name: 'Shared' },
                {
                    ...base.templates[0],
                    id: 't-t',
                    name: 'Atlas only',
                    visibility: 'team',
                    team: { id: 'team-1', name: 'Atlas' },
                },
                {
                    ...base.templates[0],
                    id: 't-p',
                    name: 'Mine',
                    visibility: 'personal',
                },
            ],
        });

        const badges = Array.from(
            document.querySelectorAll('[data-test="template-visibility"]'),
        ).map((badge) => badge.textContent);

        expect(badges).toEqual(['Workspace', 'Team · Atlas', 'Personal']);
    });

    it('offers the menu of the templates the viewer may edit only', () => {
        page({
            templates: [
                { ...base.templates[0], id: 't-1', name: 'Shared' },
                {
                    ...base.templates[0],
                    id: 't-2',
                    name: 'Mine',
                    visibility: 'personal',
                    canManage: true,
                },
            ],
        });

        expect(
            screen.queryByRole('button', { name: 'Actions for Shared' }),
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Actions for Mine' }),
        ).toBeTruthy();
    });

    it('opens the editor of a member on a personal template, the workspace and team choices disabled', async () => {
        page({ catalogue });

        await newTemplate('Retro template');

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog)
                .getByRole('radio', { name: 'Personal' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            (
                within(dialog).getByRole('radio', {
                    name: 'Workspace',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            (
                within(dialog).getByRole('radio', {
                    name: 'Team',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('opens the editor of a team facilitator on a team template of their team', async () => {
        page({
            catalogue,
            teamTemplateTeams: [{ id: 'team-1', name: 'Atlas' }],
        });

        await newTemplate('Retro template');

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog)
                .getByRole('radio', { name: 'Team' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            within(dialog).queryByRole('combobox', { name: 'Team' }),
        ).toBeNull();
    });

    it('opens the editor of a manager on a workspace template', async () => {
        page({ ...manager, catalogue });

        await newTemplate('Retro template');

        expect(
            within(screen.getByRole('dialog'))
                .getByRole('radio', { name: 'Workspace' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('opens a menu with Retro template and Poker deck from New template', async () => {
        page({ ...manager, canCreatePokerDeck: true });

        await userEvent.click(
            screen.getByRole('button', { name: 'New template' }),
        );

        expect(
            screen.getAllByRole('menuitem').map((item) => item.textContent),
        ).toEqual(['Retro template', 'Poker deck']);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the retro editor in one click, without a menu, for who may not create a deck', async () => {
        page({ ...manager, catalogue });

        await userEvent.click(
            screen.getByRole('button', { name: 'New template' }),
        );

        expect(screen.queryByRole('menuitem')).toBeNull();
        expect(
            screen.getByRole('dialog').querySelector('#template-name'),
        ).not.toBeNull();
    });

    it("opens the retro editor in a dialog from the menu and from the section's button", async () => {
        const { unmount } = page({ ...manager, catalogue });

        await newTemplate('Retro template');

        expect(screen.getByRole('dialog').getAttribute('data-slot')).toBe(
            'dialog-content',
        );
        expect(
            screen.getByRole('dialog').querySelector('#template-name'),
        ).not.toBeNull();

        unmount();
        page({ ...manager, catalogue, templates: [] });

        await userEvent.click(
            screen.getByRole('button', { name: 'Create a template' }),
        );

        expect(screen.getByRole('dialog').getAttribute('data-slot')).toBe(
            'dialog-content',
        );
        expect(
            screen.getByRole('dialog').querySelector('#template-name'),
        ).not.toBeNull();
        expect(document.querySelector('[data-slot^="sheet"]')).toBeNull();
    });

    it('opens the deck dialog from the menu, on a tab that does not show the decks too', async () => {
        page({
            ...manager,
            canCreatePokerDeck: true,
            initialTab: 'whiteboard',
        });

        await newTemplate('Poker deck');

        const dialog = screen.getByRole('dialog', { name: 'Create a deck' });

        fireEvent.change(within(dialog).getByLabelText('Name'), {
            target: { value: 'Hours' },
        });

        for (const value of ['1', '2', '4']) {
            const add = within(dialog).getByRole('textbox', {
                name: 'Add a value',
            });

            fireEvent.change(add, { target: { value } });
            fireEvent.keyDown(add, { key: 'Enter' });
        }

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/poker-decks');
        expect(mocks.post.mock.calls[0][1]).toMatchObject({
            name: 'Hours',
            cards: ['1', '2', '4'],
        });

        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onSuccess?.();
        });

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('gives the focus back to New template when a dialog opened from its menu closes', async () => {
        page({ ...manager, catalogue, canCreatePokerDeck: true });
        const button = screen.getByRole('button', { name: 'New template' });

        await newTemplate('Retro template');
        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(document.activeElement).toBe(button));

        await newTemplate('Poker deck');
        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(document.activeElement).toBe(button));
    });
});
