import { render, screen } from '@testing-library/react';
import { Crown } from 'lucide-react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
    it('renders a span with the badge slot and its text', () => {
        render(<Badge>Facilitator</Badge>);

        const badge = screen.getByText('Facilitator');

        expect(badge.tagName).toBe('SPAN');
        expect(badge.getAttribute('data-slot')).toBe('badge');
    });

    it('forwards ref, aria-label and extra class names', () => {
        const ref = createRef<HTMLSpanElement>();

        render(
            <Badge ref={ref} aria-label="6 open actions" className="extra">
                6
            </Badge>,
        );

        expect(ref.current).toBe(screen.getByLabelText('6 open actions'));
        expect(ref.current?.classList.contains('extra')).toBe(true);
    });

    it('renders the icon hidden from assistive tech before the text', () => {
        render(
            <Badge icon={Crown} variant="soft">
                Facilitator
            </Badge>,
        );

        const svg = screen.getByText('Facilitator').querySelector('svg');

        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(screen.getByText('Facilitator').firstElementChild).toBe(svg);
    });

    it('renders a coloured dot only when dot is given', () => {
        const { container, rerender } = render(<Badge>Live</Badge>);

        expect(container.querySelector('[data-slot="badge-dot"]')).toBeNull();

        rerender(<Badge dot="var(--skrum-success)">Live</Badge>);

        const dot = container.querySelector<HTMLElement>(
            '[data-slot="badge-dot"]',
        );

        expect(dot?.style.backgroundColor).toBe('var(--skrum-success)');
    });

    it('renders the child as a link with a trailing arrow when asChild', () => {
        render(
            <Badge asChild icon={Crown}>
                <a href="/team">Team</a>
            </Badge>,
        );

        const link = screen.getByRole('link', { name: 'Team' });

        expect(link.getAttribute('data-slot')).toBe('badge');
        expect(link.querySelectorAll('svg')).toHaveLength(2);
        expect(link.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    });
});
