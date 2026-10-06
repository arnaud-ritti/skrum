import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateEditorDialog } from '@/components/workspaces/template-editor-dialog';
import type { TemplateEditorTarget } from '@/components/workspaces/template-editor-dialog';
import { draftFromTemplate } from '@/lib/workspaces/template-draft';
import { renderWithProviders } from '@/test/render';
import type { WorkspaceTemplateSummary } from '@/types';

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post, patch: mocks.patch, delete: mocks.delete },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: mocks.toastError },
}));

const template: WorkspaceTemplateSummary = {
    id: 'template-1',
    name: 'Team pulse',
    category: 'team_mood',
    author: null,
    usageCount: 0,
    visibility: 'workspace',
    team: null,
    canManage: true,
    columns: [
        { title: 'Energy', description: 'How charged', color: 'moss' },
        { title: 'Blockers', description: null, color: 'coral' },
    ],
};

function editor(
    target: TemplateEditorTarget,
    teamId?: string,
    access: {
        canShareWorkspace?: boolean;
        teams?: { id: string; name: string }[];
    } = {},
) {
    const onClose = vi.fn();
    const onDuplicate = vi.fn();

    renderWithProviders(
        <TemplateEditorDialog
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            target={target}
            categories={[
                { value: 'essentials', label: 'Essentials' },
                { value: 'team_mood', label: 'Team & mood' },
            ]}
            onClose={onClose}
            onDuplicate={onDuplicate}
            teamId={teamId}
            {...access}
        />,
    );

    return { onClose, onDuplicate, dialog: screen.getByRole('dialog') };
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.delete.mockReset();
    mocks.toastError.mockReset();
});

describe('TemplateEditorDialog', () => {
    it('updates a template with its columns and closes on success', async () => {
        const { dialog, onClose } = editor({
            key: 'edit-1',
            template,
            draft: draftFromTemplate(template),
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.patch.mock.calls[0][0]).toBe(
            '/w/nordlys/templates/template-1',
        );
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'Team pulse',
            category: 'team_mood',
            visibility: 'workspace',
            team_id: null,
            columns: [
                { title: 'Energy', description: 'How charged', color: 'moss' },
                { title: 'Blockers', description: '', color: 'coral' },
            ],
        });

        await act(async () => {
            (mocks.patch.mock.calls[0][2] as VisitOptions).onSuccess?.();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays open while a save is on its way, and says so when it ends without an answer', async () => {
        const { dialog, onClose } = editor({
            key: 'edit-1',
            template,
            draft: draftFromTemplate(template),
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        const visit = mocks.patch.mock.calls[0][2] as VisitOptions;

        await act(async () => visit.onStart?.());
        await userEvent.keyboard('{Escape}');

        expect(onClose).not.toHaveBeenCalled();

        await act(async () => visit.onFinish?.());

        expect(mocks.toastError).toHaveBeenCalledWith(
            'Something went wrong. Please try again.',
        );
        expect(onClose).not.toHaveBeenCalled();
    });

    it('creates a new template and shows the error of the server on its name', async () => {
        const { dialog, onClose } = editor({
            key: 'new-1',
            template: null,
            draft: { ...draftFromTemplate(template), name: 'Team pulse' },
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.post.mock.calls[0][0]).toBe('/w/nordlys/templates');

        await act(async () => {
            (mocks.post.mock.calls[0][2] as VisitOptions).onError?.({
                name: 'The name has already been taken.',
            });
        });

        expect(
            within(dialog).getByText('The name has already been taken.'),
        ).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('creates a template of the team it is opened for', async () => {
        const { dialog } = editor(
            {
                key: 'new-2',
                template: null,
                draft: { ...draftFromTemplate(template), name: 'Atlas pulse' },
            },
            't1',
        );

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.post.mock.calls[0][1]).toMatchObject({
            name: 'Atlas pulse',
            visibility: 'team',
            team_id: 't1',
        });
    });

    it('hands the draft being edited to duplicate', async () => {
        const { dialog, onDuplicate } = editor({
            key: 'edit-2',
            template,
            draft: draftFromTemplate(template),
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Duplicate' }),
        );

        expect(onDuplicate.mock.calls[0][0].name).toBe('Team pulse');
    });

    it('deletes the template after the confirmation of the editor', async () => {
        const { dialog, onClose } = editor({
            key: 'edit-3',
            template,
            draft: draftFromTemplate(template),
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete template' }),
        );

        const confirm = screen.getByRole('alertdialog');

        expect(
            within(confirm).getByText(
                'Retros already created from it are not affected.',
            ),
        ).toBeTruthy();

        await userEvent.click(
            within(confirm).getByRole('button', { name: 'Delete template' }),
        );

        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/templates/template-1',
        );

        await act(async () => {
            (mocks.delete.mock.calls[0][1] as VisitOptions).onSuccess?.();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('posts the team of a team template chosen in the editor', async () => {
        const { dialog } = editor(
            {
                key: 'edit-4',
                template: {
                    ...template,
                    visibility: 'team',
                    team: { id: 't1', name: 'Atlas' },
                },
                draft: draftFromTemplate({
                    ...template,
                    visibility: 'team',
                    team: { id: 't1', name: 'Atlas' },
                }),
            },
            undefined,
            {
                canShareWorkspace: false,
                teams: [
                    { id: 't1', name: 'Atlas' },
                    { id: 't2', name: 'Borealis' },
                ],
            },
        );

        expect(
            (
                within(dialog).getByRole('radio', {
                    name: 'Workspace',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);

        await userEvent.click(
            within(dialog).getByRole('combobox', { name: 'Team' }),
        );
        await userEvent.click(
            await screen.findByRole('option', { name: 'Borealis' }),
        );
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.patch.mock.calls[0][1]).toMatchObject({
            visibility: 'team',
            team_id: 't2',
        });
    });

    it('posts no team for a personal template', async () => {
        const { dialog } = editor({
            key: 'new-3',
            template: null,
            draft: {
                ...draftFromTemplate(template),
                name: 'Mine',
                visibility: 'personal',
                teamId: 't1',
            },
        });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.post.mock.calls[0][1]).toMatchObject({
            visibility: 'personal',
            team_id: null,
        });
    });

    it('shows the form beside its live preview and Cancel and Save in the footer', () => {
        const { dialog } = editor({
            key: 'new-4',
            template: null,
            draft: draftFromTemplate(template),
        });
        const body = dialog.querySelector<HTMLElement>(
            '[data-slot="template-editor-body"]',
        )!;
        const footer = dialog.querySelector<HTMLElement>('footer')!;

        expect(
            dialog.querySelector('[data-slot="template-editor"] h2')
                ?.textContent,
        ).toBe('New template');
        expect(body.querySelector('#template-name')).not.toBeNull();
        expect(
            body.querySelector('[data-slot="template-preview"]'),
        ).not.toBeNull();
        expect(body.contains(footer)).toBe(false);
        expect(
            within(footer)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual(['Cancel', 'Save']);
        expect(
            within(dialog).getByRole('button', { name: 'Close' }),
        ).toBeTruthy();
    });

    it('renders no side panel', () => {
        const { dialog } = editor({
            key: 'edit-5',
            template,
            draft: draftFromTemplate(template),
        });

        expect(dialog.getAttribute('data-slot')).toBe('dialog-content');
        expect(document.querySelector('[data-slot^="sheet"]')).toBeNull();
    });

    it('puts the focus on the first field when it opens', () => {
        const { dialog } = editor({
            key: 'edit-6',
            template,
            draft: draftFromTemplate(template),
        });

        expect(document.activeElement).toBe(
            dialog.querySelector('#template-name'),
        );
    });
});
