import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhiteboardTemplatesTab } from '@/components/workspaces/whiteboard-templates-tab';
import { renderWithProviders } from '@/test/render';
import type { WorkspaceWhiteboardTemplate } from '@/types';

type VisitOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({ patch: vi.fn(), delete: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: ReactNode;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
    router: { patch: mocks.patch, delete: mocks.delete },
}));

const template: WorkspaceWhiteboardTemplate = {
    id: 'board-1',
    name: 'Kickoff map',
    description: 'Goals, risks and owners',
    preview: { width: 100, height: 60, shapes: [] },
    canManage: true,
};

function tab(templates: WorkspaceWhiteboardTemplate[]) {
    renderWithProviders(
        <WhiteboardTemplatesTab
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            templates={templates}
            hrefFor={(kind, key) => `/team?new=${kind}&template=${key}`}
        />,
    );
}

beforeEach(() => {
    mocks.patch.mockReset();
    mocks.delete.mockReset();
});

describe('WhiteboardTemplatesTab', () => {
    it('shows the empty state of the mockup without a creation button', () => {
        tab([]);

        expect(screen.getByText('No whiteboard templates yet.')).toBeTruthy();
        expect(
            screen.getByText(
                'Save any whiteboard as a template from its menu — every team of Nordlys will be able to start from it.',
            ),
        ).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows a template with its preview, its description and "Use"', () => {
        tab([template]);

        const card = screen.getByRole('article', { name: 'Kickoff map' });

        expect(within(card).getByText('Goals, risks and owners')).toBeTruthy();
        expect(
            card.querySelector('[data-slot="whiteboard-template-preview"]'),
        ).toBeTruthy();
        expect(
            within(card)
                .getByRole('link', { name: 'Use Kickoff map' })
                .getAttribute('href'),
        ).toBe('/team?new=whiteboard&template=workspace:board-1');
    });

    it('has no menu on a template the user may not manage', () => {
        tab([{ ...template, canManage: false }]);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('renames a template', async () => {
        tab([template]);

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for Kickoff map' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

        const dialog = screen.getByRole('dialog');
        const name = within(dialog).getByLabelText('Name') as HTMLInputElement;

        expect(name.value).toBe('Kickoff map');

        await userEvent.clear(name);
        await userEvent.type(name, 'Kickoff');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        expect(mocks.patch.mock.calls[0][0]).toBe(
            '/w/nordlys/whiteboard-templates/board-1',
        );
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'Kickoff',
            description: 'Goals, risks and owners',
        });

        await act(async () => {
            (mocks.patch.mock.calls[0][2] as VisitOptions).onError?.({
                name: 'The name has already been taken.',
            });
        });

        expect(
            within(screen.getByRole('dialog')).getByRole('alert').textContent,
        ).toContain('The name has already been taken.');
    });

    it('deletes a template after the confirmation', async () => {
        tab([template]);

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions for Kickoff map' }),
        );
        await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

        const confirm = screen.getByRole('alertdialog');

        expect(
            within(confirm).getByText(
                'Boards already created from it are not changed.',
            ),
        ).toBeTruthy();
        expect(mocks.delete).not.toHaveBeenCalled();

        await userEvent.click(
            within(confirm).getByRole('button', { name: 'Delete' }),
        );

        expect(mocks.delete.mock.calls[0][0]).toBe(
            '/w/nordlys/whiteboard-templates/board-1',
        );
    });
});
