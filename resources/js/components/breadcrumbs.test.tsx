import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Home } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Breadcrumb, BreadcrumbEllipsis } from '@/components/ui/breadcrumb';
import { renderWithProviders } from '@/test/render';

const crumb = (title: string, href = `/${title}`) => ({ title, href });
const seven = [
    'Home',
    'Team',
    'Module',
    'Retros',
    'Sprint',
    'Board',
    'Session',
].map((title) => crumb(title));

describe('Breadcrumbs', () => {
    it('renders nothing without items', () => {
        const { container } = renderWithProviders(
            <Breadcrumbs breadcrumbs={[]} />,
        );

        expect(container.innerHTML).toBe('');
    });

    it('renders links and the current page', () => {
        renderWithProviders(
            <Breadcrumbs breadcrumbs={[crumb('Teams'), crumb('Alpha')]} />,
        );

        expect(screen.getByRole('navigation')).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Teams' }).getAttribute('href'),
        ).toBe('/Teams');
        expect(
            screen
                .getByText('Alpha')
                .closest('[aria-current]')
                ?.getAttribute('aria-current'),
        ).toBe('page');
    });

    it('renders a single crumb as the current page', () => {
        renderWithProviders(<Breadcrumbs breadcrumbs={[crumb('Only')]} />);

        expect(
            screen
                .getByText('Only')
                .closest('[aria-current]')
                ?.getAttribute('aria-current'),
        ).toBe('page');
        expect(document.querySelector('a')).toBeNull();
    });

    it('collapses the middle levels into a menu above maxItems', async () => {
        renderWithProviders(<Breadcrumbs breadcrumbs={seven} />);

        expect(screen.queryByRole('link', { name: 'Module' })).toBeNull();
        expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Board' })).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Show full path' }),
        );
        const menu = await screen.findByRole('menu');

        expect(within(menu).getAllByRole('menuitem')).toHaveLength(4);
        expect(
            within(menu)
                .getByRole('menuitem', { name: 'Module' })
                .getAttribute('href'),
        ).toBe('/Module');
    });

    it('shows every crumb when within maxItems and honours a custom maxItems', () => {
        const { rerender } = renderWithProviders(
            <Breadcrumbs breadcrumbs={seven.slice(0, 4)} />,
        );

        expect(
            screen.queryByRole('button', { name: 'Show full path' }),
        ).toBeNull();

        rerender(<Breadcrumbs breadcrumbs={seven.slice(0, 4)} maxItems={3} />);

        expect(
            screen.getByRole('button', { name: 'Show full path' }),
        ).toBeTruthy();
    });

    it('uses a slash separator on request', () => {
        renderWithProviders(
            <Breadcrumbs
                breadcrumbs={[crumb('A'), crumb('B')]}
                separator="slash"
            />,
        );

        expect(screen.getByText('/')).toBeTruthy();
    });

    it('keeps an accessible name on the home icon crumb', () => {
        renderWithProviders(
            <Breadcrumbs
                homeIcon
                breadcrumbs={[{ ...crumb('Home'), icon: Home }, crumb('Teams')]}
            />,
        );

        expect(screen.getByRole('link', { name: 'Home' })).toBeTruthy();
    });

    it('adds a back link and a title when collapsed on mobile', () => {
        renderWithProviders(
            <Breadcrumbs collapseOnMobile breadcrumbs={seven.slice(0, 3)} />,
        );

        const back = screen.getByRole('link', { name: 'Back to Team' });

        expect(back.getAttribute('href')).toBe('/Team');
    });

    it('updates when a title changes', () => {
        const { rerender } = renderWithProviders(
            <Breadcrumbs breadcrumbs={[crumb('A'), crumb('Old')]} />,
        );

        rerender(<Breadcrumbs breadcrumbs={[crumb('A'), crumb('Renamed')]} />);

        expect(screen.getByText('Renamed')).toBeTruthy();
        expect(screen.queryByText('Old')).toBeNull();
    });
});

describe('Breadcrumb primitive', () => {
    it('names its landmark and its ellipsis through the translator', () => {
        const { container } = renderWithProviders(
            <Breadcrumb>
                <BreadcrumbEllipsis />
            </Breadcrumb>,
        );

        expect(
            screen.getByRole('navigation', { name: 'Breadcrumb' }),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-slot="breadcrumb-ellipsis"]')
                ?.textContent,
        ).toBe('Show full path');
    });
});
