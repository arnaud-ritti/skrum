import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplateEditorSheet } from '@/components/workspaces/template-editor-sheet';
import type { TemplateEditorTarget } from '@/components/workspaces/template-editor-sheet';
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
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post, patch: mocks.patch, delete: mocks.delete },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const template: WorkspaceTemplateSummary = {
    id: 'template-1',
    name: 'Team pulse',
    category: 'team_mood',
    author: null,
    usageCount: 0,
    columns: [
        { title: 'Energy', description: 'How charged', color: 'moss' },
        { title: 'Blockers', description: null, color: 'coral' },
    ],
};

function sheet(target: TemplateEditorTarget, teamId?: string) {
    const onClose = vi.fn();
    const onDuplicate = vi.fn();

    renderWithProviders(
        <TemplateEditorSheet
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            target={target}
            categories={[
                { value: 'essentials', label: 'Essentials' },
                { value: 'team_mood', label: 'Team & mood' },
            ]}
            onClose={onClose}
            onDuplicate={onDuplicate}
            teamId={teamId}
        />,
    );

    return { onClose, onDuplicate, dialog: screen.getByRole('dialog') };
}

beforeEach(() => {
    mocks.post.mockReset();
    mocks.patch.mockReset();
    mocks.delete.mockReset();
});

describe('TemplateEditorSheet', () => {
    it('updates a template with its columns and closes on success', async () => {
        const { dialog, onClose } = sheet({
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

    it('creates a new template and shows the error of the server on its name', async () => {
        const { dialog, onClose } = sheet({
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
        const { dialog } = sheet(
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
        const { dialog, onDuplicate } = sheet({
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
        const { dialog, onClose } = sheet({
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
});
