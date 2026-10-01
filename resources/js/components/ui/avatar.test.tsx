import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    PersonAvatar,
} from '@/components/ui/avatar';

describe('Avatar primitives', () => {
    it('keeps the shadcn composition and data-slots', () => {
        const { container } = render(
            <Avatar className="size-6">
                <AvatarImage src="/a.png" alt="" />
                <AvatarFallback>IB</AvatarFallback>
            </Avatar>,
        );

        expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
        expect(screen.getByText('IB').getAttribute('data-slot')).toBe(
            'avatar-fallback',
        );
    });

    it('lets a className override the default size', () => {
        const { container } = render(<Avatar className="size-6" />);
        const root = container.querySelector('[data-slot="avatar"]');

        expect(root?.className).toContain('size-6');
        expect(root?.className).not.toContain('size-8');
    });
});

describe('PersonAvatar', () => {
    it('shows two initials and names the person', () => {
        render(<PersonAvatar name="Inès Bernard" presence={3} />);

        expect(screen.getByRole('img', { name: 'Inès Bernard' })).toBeTruthy();
        expect(screen.getByText('IB')).toBeTruthy();
    });

    it('adds the status to the accessible name', () => {
        render(<PersonAvatar name="Inès B." status="online" />);

        expect(screen.getByRole('img', { name: 'Inès B., online' })).toBeTruthy();
    });

    it('announces typing and away together', () => {
        render(<PersonAvatar name="Sofia L." status="away" typing />);

        expect(
            screen.getByRole('img', { name: 'Sofia L., away, writing' }),
        ).toBeTruthy();
    });

    it('paints the fallback with the presence colour', () => {
        render(<PersonAvatar name="Sofia L." presence={5} />);

        expect(screen.getByText('SL').className).toContain(
            'bg-skrum-presence-5',
        );
    });

    it('draws a typing ring and the trema only while typing', () => {
        const { container, rerender } = render(
            <PersonAvatar name="Sofia L." presence={5} typing />,
        );

        expect(
            container.querySelector('[data-slot="avatar-typing"]'),
        ).not.toBeNull();

        rerender(<PersonAvatar name="Sofia L." presence={5} />);

        expect(container.querySelector('[data-slot="avatar-typing"]')).toBeNull();
    });

    it('renders a status dot only when a status is given', () => {
        const { container, rerender } = render(<PersonAvatar name="A B" />);

        expect(container.querySelector('[data-slot="avatar-status"]')).toBeNull();

        rerender(<PersonAvatar name="A B" status="online" />);

        expect(
            container.querySelector('[data-slot="avatar-status"]'),
        ).not.toBeNull();
    });

    it('shows an icon for a guest and a question mark for anonymous', () => {
        const { container, rerender } = render(
            <PersonAvatar name="Léa" kind="guest" />,
        );

        expect(container.querySelector('svg')).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Léa (Guest)' })).toBeTruthy();

        rerender(<PersonAvatar name="Léa" kind="anonymous" />);

        expect(screen.getByText('?')).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Anonymous' })).toBeTruthy();
    });

    it('falls back to initials when the image has not loaded', () => {
        render(<PersonAvatar name="Inès B." src="/missing.png" />);

        expect(screen.getByText('IB')).toBeTruthy();
    });

    it('drops the label when decorative', () => {
        render(<PersonAvatar name="Inès B." decorative />);

        expect(screen.queryByRole('img')).toBeNull();
    });
});
