import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardTemplateGallery } from '@/components/teams/session-create/whiteboard-template-gallery';
import { renderWithProviders } from '@/test/render';
import type { WhiteboardGalleryItem } from '@/types';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    };
});

const preview = {
    width: 200,
    height: 100,
    shapes: [
        {
            kind: 'rect' as const,
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            fill: null,
            stroke: '#1e1e1e',
            points: [],
        },
    ],
};

const items: WhiteboardGalleryItem[] = [
    {
        key: 'blank',
        workspaceTemplateId: null,
        name: 'Blank',
        description: 'An empty canvas.',
        preview: { width: 1, height: 1, shapes: [] },
    },
    {
        key: 'swot',
        workspaceTemplateId: null,
        name: 'SWOT',
        description: 'Strengths, weaknesses, opportunities and threats.',
        preview,
    },
    {
        key: 'workspace:t1',
        workspaceTemplateId: 't1',
        name: 'Kick-off map',
        description: null,
        preview,
    },
];

describe('the whiteboard template gallery', () => {
    it('shows the built-in templates and the workspace templates as two groups, each named', () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="blank"
                onValueChange={() => {}}
            />,
        );

        const groups = [
            screen.getByRole('radiogroup', { name: 'Template' }),
            screen.getByRole('radiogroup', { name: 'Workspace templates' }),
        ];

        expect(
            within(groups[0])
                .getAllByRole('radio')
                .map(
                    (tile) =>
                        tile.querySelector('span.font-medium')?.textContent,
                ),
        ).toEqual(['Blank', 'SWOT']);
        expect(
            within(groups[1])
                .getAllByRole('radio')
                .map(
                    (tile) =>
                        tile.querySelector('span.font-medium')?.textContent,
                ),
        ).toEqual(['Kick-off map']);
        expect(screen.getByText('Workspace templates')).toBeTruthy();
    });

    it('draws each tile as a preview surface, a name and a description', () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="blank"
                onValueChange={() => {}}
            />,
        );

        const swot = screen.getByRole('radio', { name: /SWOT/ });
        const surface = swot.querySelector(':scope > div');

        expect(surface?.className).toContain('bg-whiteboard-paper');
        expect(swot.querySelectorAll('svg')).toHaveLength(1);
        expect(swot.querySelector('svg rect')?.getAttribute('stroke')).toBe(
            '#1e1e1e',
        );
        expect(
            swot.querySelector('span.text-muted-foreground')?.textContent,
        ).toBe('Strengths, weaknesses, opportunities and threats.');
        expect(
            screen
                .getByRole('radio', { name: /Kick-off map/ })
                .querySelector('span.text-muted-foreground'),
        ).toBeNull();
    });

    it('lays the whiteboard templates out as a two-column grid', () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="blank"
                onValueChange={() => {}}
            />,
        );

        expect(
            document.querySelector('[data-slot="whiteboard-template-gallery"]')
                ?.className,
        ).toContain('@container/templates');

        for (const group of screen.getAllByRole('radiogroup')) {
            expect(group.className).toContain('grid-cols-1');
            expect(group.className).toContain('@xs/templates:grid-cols-2');
            expect(group.className).not.toContain('auto-fill');
        }
    });

    it("shows a template's whole name and description", () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="blank"
                onValueChange={() => {}}
            />,
        );

        for (const text of [
            screen.getByText('SWOT'),
            screen.getByText(
                'Strengths, weaknesses, opportunities and threats.',
            ),
        ]) {
            expect(text.className).toContain('break-words');
            expect(text.className).not.toContain('truncate');
            expect(text.className).not.toContain('line-clamp');
        }
    });

    it('checks exactly the chosen template', () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="workspace:t1"
                onValueChange={() => {}}
            />,
        );

        expect(
            screen
                .getAllByRole('radio')
                .filter((tile) => tile.getAttribute('aria-checked') === 'true')
                .map(
                    (tile) =>
                        tile.querySelector('span.font-medium')?.textContent,
                ),
        ).toEqual(['Kick-off map']);
    });

    it('reports the template that is clicked', () => {
        const onValueChange = vi.fn();

        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="blank"
                onValueChange={onValueChange}
            />,
        );

        fireEvent.click(screen.getByRole('radio', { name: /Kick-off map/ }));

        expect(onValueChange).toHaveBeenCalledWith('workspace:t1');
    });

    it('has one group and no workspace heading without a workspace template', () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items.slice(0, 2)}
                value="blank"
                onValueChange={() => {}}
            />,
        );

        expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
        expect(screen.queryByText('Workspace templates')).toBeNull();
    });

    it('shows six skeleton tiles and no radio while loading', () => {
        const { container } = renderWithProviders(
            <WhiteboardTemplateGallery
                items={[]}
                value="blank"
                onValueChange={() => {}}
                loading
            />,
        );

        expect(screen.queryByRole('radio')).toBeNull();
        expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
        expect(
            container.querySelectorAll('[data-slot="skeleton"]'),
        ).toHaveLength(6);
        expect(screen.getByRole('status').textContent).toBe(
            'Loading templates…',
        );
    });

    it('shows the error under the gallery', () => {
        renderWithProviders(
            <WhiteboardTemplateGallery
                items={items}
                value="blank"
                onValueChange={() => {}}
                error="Choose a template of this workspace."
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'Choose a template of this workspace.',
        );
    });
});
