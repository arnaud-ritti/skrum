import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamMark, teamMarkData } from '@/components/skrum/team-mark';

describe('TeamMark', () => {
    it('draws the initial on the team colour, hidden from assistive technologies', () => {
        const { container } = render(
            <TeamMark
                team={{ name: 'Atlas', initial: 'A', color: 'lagoon' }}
            />,
        );
        const mark = container.querySelector('[data-slot="team-mark"]');

        expect(mark?.textContent).toBe('A');
        expect(mark?.classList.contains('col-lagoon')).toBe(true);
        expect(mark?.getAttribute('aria-hidden')).toBe('true');
    });

    it('has a larger size', () => {
        const { container } = render(
            <TeamMark
                team={{ name: 'Atlas', initial: 'A', color: 'moss' }}
                size="md"
            />,
        );

        expect(
            container
                .querySelector('[data-slot="team-mark"]')
                ?.classList.contains('size-10'),
        ).toBe(true);
    });

    it('takes the first letter of the name, upper case', () => {
        expect(teamMarkData({ name: '  équipe', color: 'sun' })).toEqual({
            name: '  équipe',
            initial: 'É',
            color: 'sun',
        });
    });
});
