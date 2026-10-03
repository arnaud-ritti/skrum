import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WhiteboardThumbnail } from '@/components/teams/whiteboard-thumbnail';
import type { WhiteboardPreview } from '@/types';

const preview: WhiteboardPreview = {
    width: 400,
    height: 200,
    shapes: [
        {
            kind: 'rect',
            x: 10,
            y: 10,
            width: 80,
            height: 60,
            fill: '#fde68a',
            stroke: null,
            points: [],
        },
        {
            kind: 'ellipse',
            x: 200,
            y: 40,
            width: 60,
            height: 40,
            fill: null,
            stroke: '#1e293b',
            points: [],
        },
    ],
};

describe('the thumbnail of a whiteboard', () => {
    it('draws the shapes of the preview on the dotted paper, hidden from assistive technology', () => {
        const { container } = render(<WhiteboardThumbnail preview={preview} />);
        const thumbnail = container.querySelector(
            '[data-slot="whiteboard-thumbnail"]',
        );

        expect(thumbnail?.getAttribute('aria-hidden')).toBe('true');
        expect(thumbnail?.className).toContain('h-26');
        expect(thumbnail?.className).toContain('bg-whiteboard-dotgrid');
        expect(thumbnail?.querySelector('svg rect')).not.toBeNull();
        expect(thumbnail?.querySelector('svg ellipse')).not.toBeNull();
    });

    it('shows the paper alone while no preview is built, or for an empty board', () => {
        for (const value of [null, { ...preview, shapes: [] }]) {
            const { container, unmount } = render(
                <WhiteboardThumbnail preview={value} />,
            );

            expect(
                container.querySelector('[data-slot="whiteboard-thumbnail"]'),
            ).not.toBeNull();
            expect(container.querySelector('svg')).toBeNull();
            unmount();
        }
    });
});
