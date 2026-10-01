import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Toaster } from './sonner';

describe('Toaster', () => {
    afterEach(() => {
        act(() => {
            toast.dismiss();
        });
    });

    it('shows a toast with its title, description and status icon', async () => {
        render(<Toaster />);

        act(() => {
            toast.success('Retro created', {
                description: 'The invitation link is copied.',
            });
        });

        const title = await screen.findByText('Retro created');
        const item = title.closest('[data-sonner-toast]');

        expect(screen.getByText('The invitation link is copied.')).toBeTruthy();
        expect(item?.getAttribute('data-type')).toBe('success');
        expect(
            item?.querySelector('[data-icon] svg')?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('announces toasts politely in a labelled region', async () => {
        render(<Toaster />);

        act(() => {
            toast('Link copied');
        });

        await screen.findByText('Link copied');

        const region = screen.getByRole('region');

        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.getAttribute('aria-label')).toContain('alt+T');
    });

    it('runs the action callback when its button is clicked', async () => {
        const undo = vi.fn();

        render(<Toaster />);

        act(() => {
            toast.info('3 cards merged', {
                action: { label: 'Undo', onClick: undo },
            });
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

        expect(undo).toHaveBeenCalledTimes(1);
    });

    it('updates a persistent toast in place when the same id is reused', async () => {
        render(<Toaster />);

        act(() => {
            toast.warning('Connection lost', { id: 'ws', duration: Infinity });
        });

        await screen.findByText('Connection lost');

        act(() => {
            toast.success('Reconnected', { id: 'ws' });
        });

        await screen.findByText('Reconnected');

        expect(screen.queryByText('Connection lost')).toBeNull();
        expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1);
    });

    it('keeps every existing toast type working', async () => {
        render(<Toaster />);

        act(() => {
            toast('Plain');
            toast.error('Failed');
            toast.warning('Careful');
        });

        await waitFor(() => {
            expect(
                screen.getByText('Failed').closest('[data-sonner-toast]')?.getAttribute('data-type'),
            ).toBe('error');
        });

        expect(screen.getByText('Plain')).toBeTruthy();
        expect(screen.getByText('Careful')).toBeTruthy();
    });

    it('lets the caller override position and merge class names', async () => {
        render(
            <Toaster
                position="top-left"
                toastOptions={{ classNames: { toast: 'extra-toast' } }}
            />,
        );

        act(() => {
            toast('Link copied');
        });

        const item = (await screen.findByText('Link copied')).closest<HTMLElement>(
            '[data-sonner-toast]',
        );

        expect(item?.classList.contains('extra-toast')).toBe(true);
        expect(item?.getAttribute('data-y-position')).toBe('top');
        expect(item?.getAttribute('data-x-position')).toBe('left');
    });
});

describe('Alert', () => {
    it('renders title, description and action from props', () => {
        const onView = vi.fn();

        render(
            <Alert
                variant="warning"
                title="2 actions are not done"
                description="Pick them up or postpone them."
                action={<button onClick={onView}>View</button>}
            />,
        );

        const alert = screen.getByRole('status');

        expect(alert.getAttribute('data-slot')).toBe('alert');
        expect(
            alert.querySelector('[data-slot="alert-title"]')?.textContent,
        ).toBe('2 actions are not done');
        expect(
            alert.querySelector('[data-slot="alert-description"]')?.textContent,
        ).toBe('Pick them up or postpone them.');

        fireEvent.click(screen.getByRole('button', { name: 'View' }));

        expect(onView).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['info', 'note'],
        ['success', 'status'],
        ['warning', 'status'],
        ['error', 'alert'],
    ] as const)('gives the %s variant the %s role and a hidden icon', (variant, role) => {
        render(<Alert variant={variant} title="Title" />);

        const alert = screen.getByRole(role);

        expect(alert.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
            'true',
        );
        expect(alert.querySelector('[data-slot="alert-description"]')).toBeNull();
        expect(alert.querySelector('[data-slot="alert-action"]')).toBeNull();
    });

    it('uses the given icon instead of the variant icon', () => {
        render(<Alert variant="info" icon={EyeOff} title="Cards are hidden" />);

        const icons = screen.getByRole('note').querySelectorAll('svg');

        expect(icons).toHaveLength(1);
        expect(icons[0].classList.contains('lucide-eye-off')).toBe(true);
    });

    it('lets the caller override the role', () => {
        render(<Alert variant="info" role="status" title="Saved" />);

        expect(screen.getByRole('status').textContent).toBe('Saved');
    });

    it('keeps the composed API with the alert role and its slots', () => {
        render(
            <Alert variant="destructive" className="extra">
                <AlertTitle>Something went wrong.</AlertTitle>
                <AlertDescription>Try again.</AlertDescription>
            </Alert>,
        );

        const alert = screen.getByRole('alert');

        expect(alert.classList.contains('extra')).toBe(true);
        expect(alert.querySelector('svg')).toBeNull();
        expect(
            alert.querySelector('[data-slot="alert-title"]')?.textContent,
        ).toBe('Something went wrong.');
        expect(
            alert.querySelector('[data-slot="alert-description"]')?.textContent,
        ).toBe('Try again.');
    });
});
