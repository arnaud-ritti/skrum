import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewSessionDialog } from '@/components/teams/session-create/new-session-dialog';
import { whiteboardSessionForm } from '@/components/teams/session-create/whiteboard-session-fields';
import type { WhiteboardSessionFormProps } from '@/components/teams/session-create/whiteboard-session-fields';
import { Button } from '@/components/ui/button';
import { renderWithProviders } from '@/test/render';
import type { WhiteboardGalleryItem } from '@/types';

const mocks = vi.hoisted(() => ({ post: vi.fn(), reload: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { post: mocks.post, reload: mocks.reload },
    };
});

type VisitOptions = {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const empty = { width: 1, height: 1, shapes: [] };

const gallery: WhiteboardGalleryItem[] = [
    {
        key: 'blank',
        workspaceTemplateId: null,
        name: 'Blank',
        description: 'An empty canvas.',
        preview: empty,
    },
    {
        key: 'brainstorm',
        workspaceTemplateId: null,
        name: 'Brainstorm',
        description: 'Three areas for ideas.',
        preview: empty,
    },
    {
        key: 'workspace:t1',
        workspaceTemplateId: 't1',
        name: 'Kick-off map',
        description: 'How we start a project',
        preview: empty,
    },
];

const team = { id: 't1', name: 'Atlas' };

function open(
    props: Partial<WhiteboardSessionFormProps> = {},
    intent: Parameters<typeof NewSessionDialog>[0]['intent'] = null,
) {
    renderWithProviders(
        <NewSessionDialog
            trigger={<Button>New session</Button>}
            team={team}
            intent={intent}
            whiteboard={whiteboardSessionForm({
                workspaceSlug: 'acme',
                gallery,
                ...props,
            })}
        />,
    );

    if (intent === null) {
        fireEvent.click(screen.getByRole('button', { name: 'New session' }));
    }

    return screen.getByRole('dialog');
}

function checkedTemplates(): (string | null | undefined)[] {
    return screen
        .getAllByRole('radiogroup', { name: 'Template' })
        .flatMap((group) => within(group).getAllByRole('radio'))
        .filter((tile) => tile.getAttribute('aria-checked') === 'true')
        .map((tile) => tile.querySelector('span.font-medium')?.textContent);
}

function typeName(value: string): void {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value } });
}

function submit(dialog: HTMLElement): void {
    const button = within(dialog).getByRole('button', {
        name: 'Create & open',
    }) as HTMLButtonElement;

    fireEvent.submit(button.form as HTMLFormElement);
}

function lastPost(): [string, Record<string, unknown>, VisitOptions] {
    return mocks.post.mock.calls[mocks.post.mock.calls.length - 1] as [
        string,
        Record<string, unknown>,
        VisitOptions,
    ];
}

beforeEach(() => {
    mocks.post.mockReset();
    mocks.reload.mockReset();
});

describe('the whiteboard form', () => {
    it('opens with an empty required name, the Blank template and the guests off', () => {
        open();

        const name = screen.getByLabelText('Name') as HTMLInputElement;

        expect(name).toBe(document.querySelector('#whiteboard-title'));
        expect(name.value).toBe('');
        expect(name.required).toBe(true);
        expect(name.maxLength).toBe(120);
        expect(checkedTemplates()).toEqual(['Blank']);
        expect(
            document
                .querySelector('#new-whiteboard-guests')
                ?.getAttribute('aria-checked'),
        ).toBe('false');
        expect(mocks.reload).not.toHaveBeenCalled();
    });

    it('posts the name and the built-in template, without a workspace template', () => {
        const dialog = open();

        typeName('Sprint planning board');
        fireEvent.click(screen.getByRole('radio', { name: /Brainstorm/ }));
        submit(dialog);

        const [url, body] = lastPost();

        expect(url).toBe('/w/acme/teams/t1/whiteboards');
        expect(body).toEqual({
            title: 'Sprint planning board',
            template: 'brainstorm',
            guest_access_enabled: false,
        });
    });

    it('posts a workspace template as workspace_template_id and no template', () => {
        const dialog = open();

        typeName('From the workspace');
        fireEvent.click(screen.getByRole('radio', { name: /Kick-off map/ }));
        submit(dialog);

        expect(checkedTemplates()).toEqual(['Kick-off map']);
        expect(lastPost()[1]).toEqual({
            title: 'From the workspace',
            workspace_template_id: 't1',
            guest_access_enabled: false,
        });
    });

    it('posts "Anonymous guests allowed"', () => {
        const dialog = open();

        typeName('Open board');
        fireEvent.click(screen.getByLabelText('Anonymous guests allowed'));
        submit(dialog);

        expect(lastPost()[1]).toMatchObject({ guest_access_enabled: true });
    });

    it('does not post without a name', () => {
        const dialog = open();

        typeName('   ');
        submit(dialog);

        expect(mocks.post).not.toHaveBeenCalled();
    });

    it('asks for the gallery when the page does not have it yet, and shows skeletons', () => {
        const dialog = open({ gallery: undefined });

        expect(mocks.reload).toHaveBeenCalledWith({
            only: ['whiteboardGallery'],
        });
        expect(
            within(dialog).queryByRole('radiogroup', { name: 'Template' }),
        ).toBeNull();
        expect(dialog.querySelectorAll('[data-slot="skeleton"]').length).toBe(
            6,
        );
    });

    it('opens on the template named by the intent, by key or by workspace template id', () => {
        open({}, { type: 'whiteboard', template: 't1' });

        expect(checkedTemplates()).toEqual(['Kick-off map']);
    });

    it('falls back to Blank when the intent names an unknown template', () => {
        open({}, { type: 'whiteboard', template: 'gone' });

        expect(checkedTemplates()).toEqual(['Blank']);
    });

    it('shows the server errors under the name and under the gallery, and closes on success', () => {
        const dialog = open();

        expect(
            document
                .querySelector('#whiteboard-title')
                ?.hasAttribute('aria-describedby'),
        ).toBe(false);

        typeName('Board');
        submit(dialog);

        const [, , options] = lastPost();

        act(() => {
            options.onStart?.();
            options.onError?.({
                title: 'The title field is required.',
                workspace_template_id: 'Choose a template of this workspace.',
            });
            options.onFinish?.();
        });

        expect(
            screen.getAllByRole('alert').map((alert) => alert.textContent),
        ).toEqual([
            'The title field is required.',
            'Choose a template of this workspace.',
        ]);
        expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe(
            'true',
        );

        submit(dialog);

        act(() => {
            lastPost()[2].onSuccess?.();
        });

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
