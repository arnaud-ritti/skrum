import { fireEvent, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { renderWithProviders } from '@/test/render';

describe('Button', () => {
    it('keeps the data-slot, the ref and the click behaviour', () => {
        const ref = createRef<HTMLButtonElement>();
        const onClick = vi.fn();

        renderWithProviders(
            <Button ref={ref} onClick={onClick}>
                Save
            </Button>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(ref.current?.dataset.slot).toBe('button');
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('renders its child with asChild', () => {
        renderWithProviders(
            <Button asChild>
                <a href="/next">Next</a>
            </Button>,
        );

        const link = screen.getByRole('link', { name: 'Next' });

        expect(link.dataset.slot).toBe('button');
    });

    it('does not fire clicks when disabled', () => {
        const onClick = vi.fn();

        renderWithProviders(
            <Button disabled onClick={onClick}>
                Save
            </Button>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onClick).not.toHaveBeenCalled();
    });

    it.each([
        ['icon', 'size-9'],
        ['icon-sm', 'size-8'],
        ['icon-lg', 'size-11'],
    ] as const)('makes the %s size a square of %s', (size, square) => {
        renderWithProviders(
            <Button size={size} aria-label="Settings">
                x
            </Button>,
        );

        expect(
            screen.getByRole('button', { name: 'Settings' }).className,
        ).toContain(square);
    });

    it('gives the outline variant a card background', () => {
        expect(buttonVariants({ variant: 'outline' })).toContain('bg-card');
    });
});

describe('LoadingButton', () => {
    it('behaves like a plain button when not loading', () => {
        renderWithProviders(<LoadingButton>Create</LoadingButton>);

        const button = screen.getByRole('button', { name: 'Create' });

        expect(button.hasAttribute('disabled')).toBe(false);
        expect(button.getAttribute('aria-busy')).toBeNull();
        expect(button.querySelector('[data-slot="loader"]')).toBeNull();
    });

    it('disables, marks busy and shows the spinner while loading', () => {
        renderWithProviders(<LoadingButton loading>Creating…</LoadingButton>);

        const button = screen.getByRole('button', { name: 'Creating…' });

        expect(button.hasAttribute('disabled')).toBe(true);
        expect(button.getAttribute('aria-busy')).toBe('true');
        expect(button.querySelector('[data-loader="spinner"]')).not.toBeNull();
    });

    it('shows the trema loader on request', () => {
        renderWithProviders(
            <LoadingButton loading loader="trema">
                Connecting
            </LoadingButton>,
        );

        const loader = screen
            .getByRole('button', { name: 'Connecting' })
            .querySelector('[data-loader="trema"]');

        expect(loader?.children).toHaveLength(2);
    });

    it('does not fire onClick while loading', () => {
        const onClick = vi.fn();

        renderWithProviders(
            <LoadingButton loading onClick={onClick}>
                Creating…
            </LoadingButton>,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Creating…' }));

        expect(onClick).not.toHaveBeenCalled();
    });

    it('stays disabled when disabled and not loading', () => {
        renderWithProviders(<LoadingButton disabled>Create</LoadingButton>);

        expect(
            screen
                .getByRole('button', { name: 'Create' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('marks an asChild link busy without injecting a loader', () => {
        renderWithProviders(
            <LoadingButton asChild loading>
                <a href="/x">Go</a>
            </LoadingButton>,
        );

        const link = screen.getByRole('link', { name: 'Go' });

        expect(link.getAttribute('aria-busy')).toBe('true');
        expect(link.querySelector('[data-slot="loader"]')).toBeNull();
    });

    it('takes a loading asChild link out of the tab order and ignores its activation', () => {
        const onClick = vi.fn();
        renderWithProviders(
            <div onClick={(event) => onClick(event.defaultPrevented)}>
                <LoadingButton asChild loading>
                    <a href="/x">Go</a>
                </LoadingButton>
            </div>,
        );

        const link = screen.getByRole('link', { name: 'Go' });
        fireEvent.click(link);

        expect(link.tabIndex).toBe(-1);
        expect(onClick).toHaveBeenCalledWith(true);
    });
});
