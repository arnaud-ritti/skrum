import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LiveSessionBanner } from '@/components/teams/live-session-banner';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Link: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

const session = {
    kind: 'retro' as const,
    title: 'Sprint 42 retro',
    url: '/w/nordlys/retros/r1',
};

describe('LiveSessionBanner', () => {
    it('names the session and links to it', () => {
        renderWithProviders(
            <LiveSessionBanner session={session} onDismiss={vi.fn()} />,
        );

        expect(screen.getByRole('status').textContent).toBe(
            'A session is in progress: Sprint 42 retro',
        );
        expect(
            screen.getByRole('link', { name: 'Join' }).getAttribute('href'),
        ).toBe('/w/nordlys/retros/r1');
    });

    it('paints the icon in the colour of the session kind', () => {
        const { container } = renderWithProviders(
            <LiveSessionBanner
                session={{ ...session, kind: 'poker' }}
                onDismiss={vi.fn()}
            />,
        );

        expect(
            container
                .querySelector('[data-slot="live-session-kind"]')
                ?.classList.contains('bg-skrum-col-moss'),
        ).toBe(true);
    });

    it('is dismissed with its button', async () => {
        const onDismiss = vi.fn();

        renderWithProviders(
            <LiveSessionBanner session={session} onDismiss={onDismiss} />,
        );
        await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(onDismiss).toHaveBeenCalledOnce();
    });
});
