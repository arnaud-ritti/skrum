import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    PersonAvatar,
} from '@/components/ui/avatar';

class ImageThatLoadsUnlessMissing {
    src = '';

    get complete(): boolean {
        return true;
    }

    get naturalWidth(): number {
        return this.src.includes('missing') ? 0 : 64;
    }

    addEventListener(): void {}

    removeEventListener(): void {}
}

afterEach(() => {
    vi.unstubAllGlobals();
});

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

    it('shows the image once it loads and the initials when it fails', () => {
        vi.stubGlobal('Image', ImageThatLoadsUnlessMissing);
        const { container, rerender } = render(
            <PersonAvatar name="Inès B." src="/avatars/ines.png" />,
        );

        expect(container.querySelector('img')?.getAttribute('src')).toBe(
            '/avatars/ines.png',
        );
        expect(screen.queryByText('IB')).toBeNull();

        rerender(<PersonAvatar name="Inès B." src="/missing.png" />);

        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('IB')).toBeTruthy();
    });

    it('drops the label when decorative', () => {
        render(<PersonAvatar name="Inès B." decorative />);

        expect(screen.queryByRole('img')).toBeNull();
    });
});

describe('PersonAvatar status tooltip', () => {
    it('shows the status as text on hover, without a provider around it', async () => {
        const user = userEvent.setup();
        render(<PersonAvatar name="Inès B." status="away" typing />);

        await user.hover(screen.getByRole('img', { name: /Inès B\./ }));

        expect(
            (await screen.findByRole('tooltip')).textContent,
        ).toBe('Inès B., away, writing');
    });

    it('adds no tooltip when there is no status to tell', async () => {
        const user = userEvent.setup();
        render(<PersonAvatar name="Inès B." />);

        await user.hover(screen.getByRole('img', { name: 'Inès B.' }));

        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('draws a plain image with the given attributes, for a guest too, and drops it on error', () => {
        const onError = vi.fn();
        const { container } = render(
            <PersonAvatar
                name="Sam Guest"
                kind="guest"
                src="/avatars/guest.png"
                imgProps={{ alt: 'Sam Guest', 'data-presence-id': 'g1', onError }}
            />,
        );

        const image = container.querySelector('img') as HTMLImageElement;
        expect(image.getAttribute('src')).toBe('/avatars/guest.png');
        expect(image.getAttribute('alt')).toBe('Sam Guest');
        expect(image.getAttribute('data-presence-id')).toBe('g1');

        fireEvent.error(image);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('[data-slot="avatar-fallback"]')).not.toBeNull();
    });
});
