import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultColumnsCard } from '@/components/team-settings/default-columns-card';
import { renderWithProviders } from '@/test/render';
import type { TeamTemplateUsageRow } from '@/types';

type VisitOptions = {
    only?: string[];
    onSuccess?: (page: unknown) => void;
    onError?: (errors: Record<string, string>) => void;
    onStart?: () => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    reload: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: {
        put: mocks.put,
        post: mocks.post,
        patch: mocks.patch,
        reload: mocks.reload,
    },
}));

const teamTemplate: TeamTemplateUsageRow = {
    key: 'workspace:tpl-1',
    name: 'Atlas classic',
    category: 'ideas',
    columns: [
        { title: 'Went well', description: null, color: 'moss' },
        { title: 'To improve', description: 'Be kind', color: 'coral' },
    ],
    usageCount: 4,
    isDefault: true,
    templateId: 'tpl-1',
    canEdit: true,
};

const builtIn: TeamTemplateUsageRow = {
    ...teamTemplate,
    key: 'start_stop_continue',
    name: 'Start · Stop · Continue',
    category: null,
    templateId: null,
    canEdit: false,
};

function card(template: TeamTemplateUsageRow) {
    return renderWithProviders(
        <DefaultColumnsCard
            workspaceSlug="nordlys"
            team={{ id: 't1', name: 'Atlas' }}
            template={template}
        />,
    );
}

function section(): HTMLElement {
    return document.querySelector<HTMLElement>('section#default-columns')!;
}

beforeEach(() => {
    mocks.put.mockReset();
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.reload.mockReset();
});

describe('DefaultColumnsCard', () => {
    it('names the default template and saves its columns once they changed', async () => {
        card(teamTemplate);

        expect(
            screen.getByRole('heading', {
                name: 'Default columns · template “Atlas classic”',
            }),
        ).toBeTruthy();

        const save = within(section()).getByRole('button', { name: 'Save' });

        expect((save as HTMLButtonElement).disabled).toBe(true);

        const title = screen.getByRole('textbox', { name: 'Column 1 title' });

        await userEvent.clear(title);
        await userEvent.type(title, 'Kudos');
        await userEvent.click(save);

        expect(mocks.patch.mock.calls[0][0]).toBe('/w/nordlys/templates/tpl-1');
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'Atlas classic',
            category: 'ideas',
            columns: [
                { title: 'Kudos', description: '', color: 'moss' },
                { title: 'To improve', description: 'Be kind', color: 'coral' },
            ],
        });

        await act(async () => {
            (mocks.patch.mock.calls[0][2] as VisitOptions).onError?.({
                'columns.0.title': 'The title is too long.',
            });
        });

        expect(section().textContent).toContain('The title is too long.');
    });

    it('shows a template the viewer may not edit read-only, and duplicates it as the team default', async () => {
        card(builtIn);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(section().textContent).toContain('Went well');

        await userEvent.click(
            within(section()).getByRole('button', {
                name: 'Duplicate as a team template',
            }),
        );

        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/templates');
        expect(mocks.post.mock.calls[0][1]).toEqual({
            name: 'Copy of Start · Stop · Continue',
            category: 'essentials',
            columns: [
                { title: 'Went well', description: '', color: 'moss' },
                { title: 'To improve', description: 'Be kind', color: 'coral' },
            ],
            visibility: 'team',
            team_id: 't1',
        });

        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onSuccess?.({});
        });

        expect((mocks.reload.mock.calls[0][0] as VisitOptions).only).toEqual([
            'catalogue',
        ]);

        await act(async () => {
            (mocks.reload.mock.calls[0][0] as VisitOptions).onSuccess?.({
                props: {
                    catalogue: [
                        {
                            key: 'workspace:copy-1',
                            name: 'Copy of Start · Stop · Continue',
                            isWorkspace: true,
                        },
                    ],
                },
            });
        });

        expect(mocks.put.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/default-retro-template',
        );
        expect(mocks.put.mock.calls[0][1]).toEqual({
            template: 'workspace:copy-1',
        });
    });

    it('says so instead of failing silently when the copy is not in the reloaded catalogue', async () => {
        card(builtIn);

        await userEvent.click(
            within(section()).getByRole('button', {
                name: 'Duplicate as a team template',
            }),
        );

        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onSuccess?.({});
        });
        await act(async () => {
            (mocks.reload.mock.calls[0][0] as VisitOptions).onSuccess?.({
                props: { catalogue: [] },
            });
        });

        expect(mocks.put).not.toHaveBeenCalled();
        expect(within(section()).getByRole('alert').textContent).toBe(
            'Something went wrong. Please try again.',
        );
    });

    it('keeps the duplication busy until the copy is the default, then says why it was refused', async () => {
        card(builtIn);

        const duplicateButton = within(section()).getByRole('button', {
            name: 'Duplicate as a team template',
        });

        await userEvent.click(duplicateButton);

        const post = mocks.post.mock.calls[0][2] as VisitOptions;

        await act(async () => {
            post.onStart?.();
            post.onSuccess?.({});
            post.onFinish?.();
        });

        expect(duplicateButton.hasAttribute('disabled')).toBe(true);

        await act(async () => {
            (mocks.reload.mock.calls[0][0] as VisitOptions).onSuccess?.({
                props: {
                    catalogue: [
                        {
                            key: 'workspace:copy-1',
                            name: 'Copy of Start · Stop · Continue',
                            isWorkspace: true,
                        },
                    ],
                },
            });
        });

        expect(duplicateButton.hasAttribute('disabled')).toBe(true);

        const put = mocks.put.mock.calls[0][2] as VisitOptions;

        await act(async () => {
            put.onError?.({ template: 'Only team owners can do this.' });
            put.onFinish?.();
        });

        expect(within(section()).getByRole('alert').textContent).toBe(
            'Only team owners can do this.',
        );
        expect(duplicateButton.hasAttribute('disabled')).toBe(false);
    });
});
