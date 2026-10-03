import { fireEvent, render, screen } from '@testing-library/react';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/components/skrum/empty-state';

describe('EmptyState', () => {
    it('shows module label, a real heading, description and the illustration hidden from assistive tech', () => {
        render(
            <EmptyState
                module="retro"
                title="No retro yet"
                description="Start the first one."
            />,
        );

        expect(
            screen.getByRole('heading', { level: 2, name: 'No retro yet' }),
        ).toBeTruthy();
        expect(screen.getByText('Retrospective')).toBeTruthy();
        expect(screen.getByText('Start the first one.')).toBeTruthy();
        const art = document.querySelector('[data-slot="empty-state-art"]');
        expect(art?.getAttribute('aria-hidden')).toBe('true');
    });

    it('labels every module', () => {
        const labels = {
            retro: 'Retrospective',
            poker: 'Planning poker',
            whiteboard: 'Whiteboard',
            survey: 'Surveys',
            icebreaker: 'Icebreakers',
            actions: 'Actions',
            sessions: 'Sessions',
        } as const;

        Object.entries(labels).forEach(([module, label]) => {
            const { unmount } = render(
                <EmptyState
                    module={module as keyof typeof labels}
                    title="t"
                    description="d"
                />,
            );

            expect(screen.getByText(label)).toBeTruthy();
            unmount();
        });
    });

    it('draws a different illustration for every module', () => {
        const modules = [
            'retro',
            'poker',
            'whiteboard',
            'survey',
            'icebreaker',
            'actions',
            'sessions',
        ] as const;
        const markups = modules.map((module) => {
            const { container, unmount } = render(
                <EmptyState module={module} title="t" description="d" />,
            );
            const markup =
                container.querySelector('[data-slot="empty-state-art"]')
                    ?.innerHTML ?? '';
            unmount();

            return markup;
        });

        expect(new Set(markups).size).toBe(modules.length);
        markups.forEach((markup) => expect(markup.length).toBeGreaterThan(0));
    });

    it('omits the illustration for a filtered empty list', () => {
        render(
            <EmptyState
                module="actions"
                title="Nothing matches"
                description="Try other filters."
                illustration={false}
            />,
        );

        expect(
            document.querySelector('[data-slot="empty-state-art"]'),
        ).toBeNull();
    });

    it('honours the heading level', () => {
        render(
            <EmptyState
                module="poker"
                title="T"
                description="d"
                headingLevel="h3"
            />,
        );

        expect(screen.getByRole('heading', { level: 3 })).toBeTruthy();
    });

    it('calls the action and the secondary action callbacks', () => {
        const onAction = vi.fn();
        const onSecondary = vi.fn();
        render(
            <EmptyState
                module="poker"
                title="T"
                description="d"
                action={{ label: 'Import', icon: Plus, onClick: onAction }}
                secondaryAction={{ label: 'Add a story', onClick: onSecondary }}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Import' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add a story' }));

        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it('renders no button when no action is given', () => {
        render(<EmptyState module="survey" title="T" description="d" />);

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('renders a link for an action with href', () => {
        render(
            <EmptyState
                module="retro"
                title="T"
                description="d"
                action={{ label: 'New retro', href: '/retros/create' }}
            />,
        );

        const link = screen.getByRole('link', { name: 'New retro' });
        expect(link.getAttribute('href')).toBe('/retros/create');
    });

    it('focuses the primary action only when asked to', () => {
        const { unmount } = render(
            <EmptyState
                module="retro"
                title="T"
                description="d"
                action={{ label: 'Go', onClick: () => {} }}
            />,
        );
        expect(document.activeElement).not.toBe(
            screen.getByRole('button', { name: 'Go' }),
        );
        unmount();

        render(
            <EmptyState
                module="retro"
                title="T"
                description="d"
                autoFocusAction
                action={{ label: 'Go', onClick: () => {} }}
            />,
        );
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Go' }),
        );
    });
});
