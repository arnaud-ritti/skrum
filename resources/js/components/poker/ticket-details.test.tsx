import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TicketChips, TicketCriteria } from '@/components/poker/ticket-details';
import type { PokerTaskExternal } from '@/lib/poker/types';

function external(
    overrides: Partial<PokerTaskExternal> = {},
): PokerTaskExternal {
    return {
        source: 'jira',
        key: 'ATLAS-1287',
        url: 'https://acme.atlassian.net/browse/ATLAS-1287',
        type: null,
        labels: [],
        isManaged: true,
        ...overrides,
    };
}

describe('TicketChips', () => {
    it('shows the type, then each label in order', () => {
        render(
            <TicketChips
                external={external({
                    type: 'Story',
                    labels: ['Actions', 'Export'],
                })}
            />,
        );

        const chips = Array.from(
            document.querySelectorAll(
                '[data-slot="ticket-type"], [data-slot="ticket-label"]',
            ),
        ).map((chip) => [chip.getAttribute('data-slot'), chip.textContent]);

        expect(chips).toEqual([
            ['ticket-type', 'Story'],
            ['ticket-label', 'Actions'],
            ['ticket-label', 'Export'],
        ]);
    });

    it('shows at most ten labels', () => {
        const labels = Array.from({ length: 12 }, (_, index) => `L${index}`);

        render(<TicketChips external={external({ labels })} />);

        expect(
            document.querySelectorAll('[data-slot="ticket-label"]'),
        ).toHaveLength(10);
    });

    it('renders nothing for a ticket without type or labels', () => {
        const { container } = render(<TicketChips external={external()} />);

        expect(container.innerHTML).toBe('');
    });

    it('renders nothing for a task without a ticket', () => {
        const { container } = render(<TicketChips external={null} />);

        expect(container.innerHTML).toBe('');
    });
});

describe('TicketCriteria', () => {
    it('shows the app heading and the rendered section', () => {
        render(<TicketCriteria html="<ul><li>UTF-8 encoding</li></ul>" />);

        const block = document.querySelector('[data-slot="ticket-criteria"]');

        expect(
            screen.getByRole('heading', { name: 'Acceptance criteria' }),
        ).toBeTruthy();
        expect(block?.querySelector('li')?.textContent).toBe('UTF-8 encoding');
    });

    it('renders nothing when the description has no such section', () => {
        const { container } = render(<TicketCriteria html="" />);

        expect(container.innerHTML).toBe('');
    });
});
