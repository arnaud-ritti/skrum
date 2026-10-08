import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '@/components/ui/switch';
import { renderWithProviders } from '@/test/render';

function described(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

describe('Switch', () => {
    it('has the switch role, a name and a description', () => {
        renderWithProviders(
            <Switch checked={false} label="Reactions" description="Emoji on cards" />,
        );
        const toggle = screen.getByRole('switch', { name: 'Reactions' });

        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(described(toggle)).toBe('Emoji on cards');
    });

    it('keeps its description alongside a caller aria-describedby', () => {
        renderWithProviders(
            <>
                <span id="reactions-error">Saving failed</span>
                <Switch
                    checked={false}
                    label="Reactions"
                    description="Emoji on cards"
                    aria-describedby="reactions-error"
                />
            </>,
        );

        expect(
            described(screen.getByRole('switch', { name: 'Reactions' })),
        ).toBe('Emoji on cards Saving failed');
    });

    it('toggles on label click and on Space', async () => {
        const user = userEvent.setup();
        const onCheckedChange = vi.fn();

        renderWithProviders(
            <Switch checked={false} label="Reactions" onCheckedChange={onCheckedChange} />,
        );
        fireEvent.click(screen.getByText('Reactions'));
        expect(onCheckedChange).toHaveBeenLastCalledWith(true);

        await user.tab();
        await user.keyboard(' ');
        expect(onCheckedChange).toHaveBeenCalledTimes(2);
    });

    it('locks and explains why', () => {
        const onCheckedChange = vi.fn();

        renderWithProviders(
            <Switch
                checked
                label="Require SSO"
                lockedReason="Enforced by the instance"
                onCheckedChange={onCheckedChange}
            />,
        );
        const toggle = screen.getByRole('switch', { name: 'Require SSO' });

        expect((toggle as HTMLButtonElement).disabled).toBe(true);
        expect(described(toggle)).toBe('Enforced by the instance');
        expect(screen.getByText('Enforced by the instance')).toBeTruthy();

        fireEvent.click(screen.getByText('Require SSO'));
        expect(onCheckedChange).not.toHaveBeenCalled();
    });

    it('places the thumb with the same inset off and on', () => {
        const { container } = renderWithProviders(<Switch checked={false} />);
        const track = container.querySelector('[data-slot="switch"]');
        const thumb = container.querySelector('[data-slot="switch-thumb"]');

        expect(track?.className).toContain('h-5 w-9');
        expect(track?.classList.contains('p-0.5')).toBe(true);
        expect(thumb?.classList.contains('size-4')).toBe(true);
        expect(thumb?.classList.contains('translate-x-0')).toBe(true);
        expect(
            thumb?.classList.contains('data-[state=checked]:translate-x-4'),
        ).toBe(true);
    });

    it('follows prop changes', () => {
        const { rerender } = renderWithProviders(<Switch checked={false} label="A" />);
        rerender(<Switch checked label="A" />);

        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    });
});
