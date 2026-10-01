import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    CursorLayer,
    LiveCursor,
    truncateCursorName,
} from '@/components/skrum/live-cursor';

const base = { userId: 'u1', name: 'Camille', presence: 4, x: 10, y: 20 };

describe('LiveCursor', () => {
    it('is decorative and non interactive', () => {
        const { container } = render(<LiveCursor {...base} />);
        const cursor = container.querySelector('[data-slot="live-cursor"]');

        expect(cursor?.getAttribute('aria-hidden')).toBe('true');
        expect(cursor?.className).toContain('pointer-events-none');
    });

    it('shows the name and the action', () => {
        render(<LiveCursor {...base} name="Inès" action="dragging" />);

        expect(screen.getByText('Inès · moves')).toBeTruthy();
    });

    it('hides the label when idle', () => {
        const { container } = render(<LiveCursor {...base} idle />);

        expect(
            container.querySelector('[data-slot="live-cursor-label"]'),
        ).toBeNull();
    });

    it('maps the presence to its colour tokens and wraps out of range values', () => {
        const { container } = render(<LiveCursor {...base} presence={14} />);
        const cursor = container.querySelector<HTMLElement>(
            '[data-slot="live-cursor"]',
        );

        expect(cursor?.style.getPropertyValue('--cur')).toBe(
            'var(--skrum-presence-2)',
        );
        expect(cursor?.style.getPropertyValue('--cur-fg')).toBe(
            'var(--skrum-presence-2-foreground)',
        );
    });

    it('truncates long names to 16 characters', () => {
        expect(truncateCursorName('Loutre pensive')).toBe('Loutre pensive');
        expect(truncateCursorName('Un pseudo vraiment tres long')).toBe(
            'Un pseudo vraim…',
        );
    });
});

describe('CursorLayer', () => {
    const viewport = { x: 100, y: 50, zoom: 2 };

    it('places cursors in screen coordinates from the viewport', () => {
        const { container } = render(
            <CursorLayer
                cursors={[{ ...base, x: 110, y: 60 }]}
                visible
                shareMine
                viewport={viewport}
            />,
        );
        const cursor = container.querySelector<HTMLElement>(
            '[data-slot="live-cursor"]',
        );

        expect(cursor?.style.transform).toBe('translate(20px, 20px)');
    });

    it('replaces cursors by a count badge when hidden', () => {
        const { container } = render(
            <CursorLayer
                cursors={[base, { ...base, userId: 'u2' }]}
                visible={false}
                shareMine
                viewport={viewport}
            />,
        );

        expect(screen.getByRole('status').textContent).toContain(
            '2 cursors hidden',
        );
        expect(container.querySelector('[data-slot="live-cursor"]')).toBeNull();
    });

    it('renders nothing when hidden without cursors', () => {
        const { container } = render(
            <CursorLayer
                cursors={[]}
                visible={false}
                shareMine
                viewport={viewport}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    it('caps the number of cursors at 20', () => {
        const cursors = Array.from({ length: 25 }, (_, i) => ({
            ...base,
            userId: `u${i}`,
        }));
        const { container } = render(
            <CursorLayer
                cursors={cursors}
                visible
                shareMine
                viewport={viewport}
            />,
        );

        expect(
            container.querySelectorAll('[data-slot="live-cursor"]').length,
        ).toBe(20);
    });
});
