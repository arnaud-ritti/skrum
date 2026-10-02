import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Library, LayoutTemplate } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { SectionActionsMenu } from '@/components/teams/section-actions-menu';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    reload: vi.fn(),
    props: {
        translations: {},
        locale: 'en',
        errors: {} as Record<string, string>,
    },
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: mocks.props }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
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
        },
    };
});

describe('the "…" menu of a section', () => {
    it('is a button named after its section that opens a menu of links and actions', async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();

        renderWithProviders(
            <SectionActionsMenu
                label="Planning poker actions"
                items={[
                    { label: 'Saved decks', icon: Library, href: '/decks' },
                    {
                        label: 'Whiteboard templates',
                        icon: LayoutTemplate,
                        onSelect,
                    },
                ]}
            />,
        );

        expect(screen.queryByRole('menuitem')).toBeNull();

        await user.click(
            screen.getByRole('button', { name: 'Planning poker actions' }),
        );

        expect(
            screen
                .getByRole('menuitem', { name: 'Saved decks' })
                .getAttribute('href'),
        ).toBe('/decks');

        await user.click(
            screen.getByRole('menuitem', { name: 'Whiteboard templates' }),
        );

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('opens with the keyboard on its first entry', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <SectionActionsMenu
                label="Whiteboards actions"
                items={[
                    {
                        label: 'Whiteboard templates',
                        icon: LayoutTemplate,
                        onSelect: () => {},
                    },
                ]}
            />,
        );

        screen.getByRole('button', { name: 'Whiteboards actions' }).focus();
        await user.keyboard('{Enter}');

        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Whiteboard templates' }),
        );
    });
});
