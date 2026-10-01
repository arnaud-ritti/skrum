import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AvatarStack } from '@/components/skrum/avatar-stack';

const people = Array.from({ length: 9 }, (_, index) => ({
    name: `Person ${index}`,
}));

describe('AvatarStack', () => {
    it('shows at most five avatars and the remainder as +N', () => {
        const { container } = render(<AvatarStack people={people} />);

        expect(
            container.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(5);
        expect(screen.getByText('+4')).toBeTruthy();
        expect(screen.getByRole('img', { name: '4 more' })).toBeTruthy();
    });

    it('honours max', () => {
        const { container } = render(<AvatarStack people={people} max={2} />);

        expect(
            container.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(2);
        expect(screen.getByText('+7')).toBeTruthy();
    });

    it('shows no remainder when everyone fits', () => {
        render(<AvatarStack people={people.slice(0, 3)} />);

        expect(screen.queryByText(/^\+/)).toBeNull();
    });

    it('renders an empty stack without throwing', () => {
        const { container } = render(<AvatarStack people={[]} />);

        expect(
            container.querySelectorAll('[data-slot="person-avatar"]'),
        ).toHaveLength(0);
    });

    it('animates only people who join after the first render', () => {
        const { container, rerender } = render(
            <AvatarStack people={people.slice(0, 2)} />,
        );

        rerender(<AvatarStack people={people.slice(0, 3)} />);

        const avatars = container.querySelectorAll(
            '[data-slot="person-avatar"]',
        );

        expect(avatars[1].className).not.toContain('animate-in');
        expect(avatars[2].className).toContain('animate-in');
    });
});
