import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamRoleBadge } from '@/components/teams/team-role-badge';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    };
});

describe('the role of a member of the team', () => {
    it('names an owner, a facilitator and an observer', () => {
        for (const [role, label] of [
            ['owner', 'Owner'],
            ['facilitator', 'Facilitator'],
            ['observer', 'Observer'],
        ] as const) {
            const { container, unmount } = render(
                <TeamRoleBadge role={role} />,
            );

            expect(
                container.querySelector('[data-test="member-role"]')
                    ?.textContent,
            ).toBe(label);
            unmount();
        }
    });

    it('says nothing for a plain member, as the mockup', () => {
        const { container, rerender } = render(<TeamRoleBadge role="member" />);

        expect(container.innerHTML).toBe('');

        rerender(<TeamRoleBadge role={undefined} />);

        expect(container.innerHTML).toBe('');
    });
});
