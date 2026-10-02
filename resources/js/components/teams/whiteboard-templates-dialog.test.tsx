import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhiteboardTemplatesDialog } from '@/components/teams/whiteboard-templates-dialog';
import { renderWithProviders } from '@/test/render';
import type { WhiteboardTemplateSummary } from '@/types';

const mocks = vi.hoisted(() => ({
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: {
            patch: mocks.patch,
            delete: mocks.delete,
            reload: mocks.reload,
        },
    };
});

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onHttpException?: () => boolean;
    onFinish?: () => void;
};

const templates: WhiteboardTemplateSummary[] = [
    {
        id: 'a',
        name: 'Kick-off',
        description: 'How we start a project',
        canManage: true,
    },
    { id: 'b', name: 'Second', description: null, canManage: true },
    { id: 'c', name: 'Not mine', description: null, canManage: false },
];

function open(list: WhiteboardTemplateSummary[] = templates): HTMLElement {
    renderWithProviders(
        <WhiteboardTemplatesDialog workspaceSlug="acme" templates={list} />,
    );

    fireEvent.click(
        screen.getByRole('button', { name: 'Whiteboard templates' }),
    );

    return screen.getByRole('dialog');
}

function row(name: string): HTMLElement {
    const title = screen
        .getAllByText(name)
        .find((node) => node.tagName === 'P') as HTMLElement;

    return title.closest('li') as HTMLElement;
}

beforeEach(() => {
    mocks.patch.mockReset();
    mocks.delete.mockReset();
    mocks.reload.mockReset();
});

describe('the whiteboard templates manager', () => {
    it('lists each template in a row, with Edit and Delete named after it only for who may manage it', () => {
        const dialog = open();

        expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
        expect(
            within(row('Kick-off')).getByText('How we start a project'),
        ).toBeTruthy();
        expect(
            within(row('Kick-off')).getByRole('button', {
                name: 'Edit Kick-off',
            }).textContent,
        ).toBe('Edit');
        expect(
            within(row('Kick-off')).getByRole('button', {
                name: 'Delete Kick-off',
            }).textContent,
        ).toBe('Delete');
        expect(within(row('Not mine')).queryByRole('button')).toBeNull();
    });

    it('says how to make a template when there is none', () => {
        const dialog = open([]);

        expect(
            within(dialog).getByText('No whiteboard templates yet.'),
        ).toBeTruthy();
        expect(
            within(dialog).getByText(
                'Save a board as a template from its menu.',
            ),
        ).toBeTruthy();
        expect(within(dialog).queryByRole('list')).toBeNull();
    });

    it('edits the name and the description in the row and saves them', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Edit Kick-off' }));

        const name = document.querySelector(
            '#whiteboard-template-a-name',
        ) as HTMLInputElement;
        const description = document.querySelector(
            '#whiteboard-template-a-description',
        ) as HTMLInputElement;

        expect(name.hasAttribute('aria-describedby')).toBe(false);
        expect(description.hasAttribute('aria-describedby')).toBe(false);

        expect(name.value).toBe('Kick-off');
        expect(name.maxLength).toBe(80);
        expect(name.required).toBe(true);
        expect(description.value).toBe('How we start a project');
        expect(description.maxLength).toBe(300);

        fireEvent.change(name, { target: { value: 'Renamed' } });
        fireEvent.change(description, { target: { value: 'Edited' } });
        fireEvent.submit(name.form as HTMLFormElement);

        const [url, body, options] = mocks.patch.mock.calls[0] as [
            string,
            Record<string, unknown>,
            VisitOptions,
        ];

        expect(url).toBe('/w/acme/whiteboard-templates/a');
        expect(body).toEqual({ name: 'Renamed', description: 'Edited' });

        act(() => {
            options.onError?.({
                name: 'A template with this name already exists.',
            });
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'A template with this name already exists.',
        );
        expect(name.getAttribute('aria-invalid')).toBe('true');

        act(() => {
            options.onSuccess?.();
        });

        expect(
            document.querySelector('#whiteboard-template-a-name'),
        ).toBeNull();
    });

    it('leaves the edit form with Cancel, without a request', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Edit Second' }));
        fireEvent.click(
            within(row('Kick-off').parentElement as HTMLElement).getByRole(
                'button',
                { name: 'Cancel' },
            ),
        );

        expect(
            document.querySelector('#whiteboard-template-b-name'),
        ).toBeNull();
        expect(mocks.patch).not.toHaveBeenCalled();
    });

    it('asks for a confirmation in a dialog before a deletion, and keeps the template on Cancel', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Delete Second' }));

        const confirm = screen.getByRole('alertdialog');

        expect(within(confirm).getByText('Delete this template?')).toBeTruthy();
        expect(
            within(confirm).getByText(
                'Boards already created from it are not changed.',
            ),
        ).toBeTruthy();

        fireEvent.click(
            within(confirm).getByRole('button', { name: 'Cancel' }),
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(mocks.delete).not.toHaveBeenCalled();
        expect(row('Second')).toBeTruthy();
    });

    it('deletes the template once the deletion is confirmed', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Delete Second' }));
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Delete',
            }),
        );

        const [url, options] = mocks.delete.mock.calls[0] as [
            string,
            VisitOptions,
        ];

        expect(url).toBe('/w/acme/whiteboard-templates/b');

        act(() => {
            options.onSuccess?.();
            options.onFinish?.();
        });

        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('reloads the templates when the server refuses a deletion', () => {
        open();

        fireEvent.click(screen.getByRole('button', { name: 'Delete Second' }));
        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Delete',
            }),
        );

        const options = mocks.delete.mock.calls[0][1] as VisitOptions;
        let handled: boolean | undefined;

        act(() => {
            handled = options.onHttpException?.();
            options.onFinish?.();
        });

        expect(handled).toBe(false);
        expect(mocks.reload).toHaveBeenCalledWith({
            only: ['whiteboardTemplates', 'whiteboardGallery'],
        });
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});
