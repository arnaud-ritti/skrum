import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    TemplateCard,
    TemplateColumnsPreview,
} from '@/components/workspaces/template-card';
import type { TemplateCardProps } from '@/components/workspaces/template-card';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
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
}));

function card(overrides: Partial<TemplateCardProps> = {}) {
    renderWithProviders(
        <TemplateCard
            name="4L"
            meta="4 columns · used 12×"
            preview={
                <TemplateColumnsPreview
                    columns={[
                        { title: 'Liked', description: null, color: 'moss' },
                        { title: 'Learned', description: null, color: 'sky' },
                    ]}
                />
            }
            author={{ name: 'Camille R', avatarUrl: '' }}
            useHref="/w/nordlys/teams/team-1?new=retro&template=four_ls"
            {...overrides}
        />,
    );

    return screen.getByRole('article', { name: '4L' });
}

describe('TemplateCard', () => {
    it('shows the preview, the name, the facts, the author and a "Use" link', () => {
        const article = card();
        const columns = within(article).getByRole('list', { name: 'Columns' });

        expect(within(columns).getByText('Liked')).toBeTruthy();
        expect(within(columns).getByText('Learned')).toBeTruthy();
        expect(within(article).getByText('4 columns · used 12×')).toBeTruthy();
        expect(within(article).getByText('By Camille R')).toBeTruthy();

        const use = within(article).getByRole('link', { name: 'Use 4L' });

        expect(use.textContent).toBe('Use');
        expect(use.getAttribute('href')).toBe(
            '/w/nordlys/teams/team-1?new=retro&template=four_ls',
        );
    });

    it('has no menu and no author line without them', () => {
        const article = card({ author: null });

        expect(within(article).queryByRole('button')).toBeNull();
        expect(within(article).queryByText(/^By /)).toBeNull();
    });

    it('keeps "Use" in place, inert, with its hint when there is no team', () => {
        const article = card({ useHref: null });
        const use = within(article).getByRole('button', { name: 'Use 4L' });

        expect(within(article).queryByRole('link')).toBeNull();
        expect(use.getAttribute('aria-disabled')).toBe('true');
        expect(
            document.getElementById(use.getAttribute('aria-describedby') ?? '')
                ?.textContent,
        ).toBe('Pick a team first');
    });

    it('opens its entries from the "…" menu', async () => {
        const onEdit = vi.fn();
        const article = card({
            menu: [
                { type: 'item', label: 'Edit', onSelect: onEdit },
                { type: 'separator' },
                {
                    type: 'item',
                    label: 'Delete',
                    tone: 'danger',
                    onSelect: vi.fn(),
                },
            ],
        });

        await userEvent.click(
            within(article).getByRole('button', { name: 'Actions for 4L' }),
        );

        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeTruthy();

        await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

        expect(onEdit).toHaveBeenCalledTimes(1);
    });
});
