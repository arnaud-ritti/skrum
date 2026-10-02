import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserInfo } from '@/components/user-info';
import type { User } from '@/types';

const user: User = {
    id: '0199a000-0000-7000-8000-000000000001',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    avatarUrl: '/avatars/a.svg',
    email_verified_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

describe('UserInfo', () => {
    it('shows the name beside a decorative avatar', () => {
        const { container } = render(<UserInfo user={user} />);

        const avatar = container.querySelector('[data-slot="person-avatar"]');

        expect(screen.getByText('Ada Lovelace')).toBeTruthy();
        expect(avatar?.getAttribute('aria-hidden')).toBe('true');
        expect(avatar?.textContent).toBe('AL');
        expect(screen.queryByText('ada@example.com')).toBeNull();
    });

    it('adds the email on request', () => {
        render(<UserInfo user={user} showEmail />);

        expect(screen.getByText('ada@example.com')).toBeTruthy();
    });
});
