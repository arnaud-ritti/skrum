import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardSkeleton, ListSkeleton } from './skeletons';

describe('BoardSkeleton', () => {
    it('is a busy labelled group with no status by default', () => {
        render(<BoardSkeleton />);

        expect(
            screen
                .getByLabelText('Loading the board')
                .getAttribute('aria-busy'),
        ).toBe('true');
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('renders the requested number of columns with decorative content', () => {
        const { container } = render(
            <BoardSkeleton columns={4} cardsPerColumn={[1]} />,
        );

        expect(
            container.querySelectorAll('[aria-hidden="true"].flex-1'),
        ).toHaveLength(4);
    });

    it('announces the status message once', () => {
        render(<BoardSkeleton status="Connecting…" />);

        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getByRole('status').textContent).toContain('Connecting…');
    });

    it('renders no column for zero columns', () => {
        render(<BoardSkeleton columns={0} />);

        expect(
            screen.getByLabelText('Loading the board').children,
        ).toHaveLength(0);
    });
});

describe('ListSkeleton', () => {
    it('renders the requested rows', () => {
        const { container } = render(<ListSkeleton rows={3} />);

        expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(
            3,
        );
        expect(
            screen.getByLabelText('Loading sessions').getAttribute('aria-busy'),
        ).toBe('true');
    });

    it('omits avatar and badge when asked', () => {
        const full = render(<ListSkeleton rows={1} />).container;
        const bare = render(
            <ListSkeleton rows={1} withAvatar={false} withBadge={false} />,
        ).container;

        const blocks = (root: HTMLElement) =>
            root.querySelectorAll('[data-slot="skeleton"]').length;

        expect(blocks(full)).toBe(4);
        expect(blocks(bare)).toBe(2);
    });
});
