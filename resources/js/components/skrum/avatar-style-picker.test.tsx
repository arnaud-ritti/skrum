import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarStylePicker } from '@/components/skrum/avatar-style-picker';
import type { AvatarStyleOption } from '@/components/skrum/avatar-style-picker';
import { renderWithProviders } from '@/test/render';

const options: AvatarStyleOption[] = [
    {
        value: 'initials',
        name: 'Initials',
        license: 'CC0 1.0',
        sampleUrls: [],
    },
    {
        value: 'notionists',
        name: 'Notionists',
        license: 'CC0 1.0',
        recommended: true,
        sampleUrls: ['/avatars/11111111111111111111111111111111.svg'],
    },
    {
        value: 'funEmoji',
        name: 'Fun Emoji',
        license: 'CC BY 4.0',
        attribution: 'Fun Emoji by Davis Uche, CC BY 4.0',
        sampleUrls: [],
    },
];

const names = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing'];

function setup(overrides = {}) {
    const onChange = vi.fn();
    const onAllow = vi.fn();
    const utils = renderWithProviders(
        <AvatarStylePicker
            value="notionists"
            onChange={onChange}
            options={options}
            sampleNames={names}
            allowMemberChoice={false}
            onAllowMemberChoiceChange={onAllow}
            {...overrides}
        />,
    );

    return { onChange, onAllow, ...utils };
}

describe('AvatarStylePicker', () => {
    it('renders a radiogroup with the selected tile checked', () => {
        setup();

        expect(screen.getByRole('radiogroup')).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(
            screen
                .getByRole('radio', { name: 'Notionists' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByText('Initials')).toBeTruthy();
    });

    it('shows license and attribution text for CC BY styles', () => {
        setup();

        expect(
            screen.getByText('Fun Emoji by Davis Uche, CC BY 4.0'),
        ).toBeTruthy();
    });

    it('selects a tile on click and with Space', () => {
        const { onChange } = setup();

        fireEvent.click(screen.getByRole('radio', { name: 'Fun Emoji' }));
        expect(onChange).toHaveBeenLastCalledWith('funEmoji');

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Initials' }), {
            key: ' ',
        });
        expect(onChange).toHaveBeenLastCalledWith('initials');
    });

    it('moves selection with arrow keys and wraps', () => {
        const { onChange } = setup();
        const current = screen.getByRole('radio', { name: 'Notionists' });

        fireEvent.keyDown(current, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith('funEmoji');

        fireEvent.keyDown(current, { key: 'ArrowLeft' });
        expect(onChange).toHaveBeenLastCalledWith('initials');

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Fun Emoji' }), {
            key: 'ArrowDown',
        });
        expect(onChange).toHaveBeenLastCalledWith('initials');
    });

    it('uses a roving tabindex', () => {
        setup();

        expect(screen.getByRole('radio', { name: 'Notionists' }).tabIndex).toBe(
            0,
        );
        expect(screen.getByRole('radio', { name: 'Initials' }).tabIndex).toBe(
            -1,
        );
    });

    it('toggles member choice with the switch', () => {
        const { onAllow } = setup();

        fireEvent.click(screen.getByRole('switch'));

        expect(onAllow).toHaveBeenCalledWith(true);
    });

    it('locks the grid and hides the switch', () => {
        const { onChange } = setup({ locked: true });

        fireEvent.click(screen.getByRole('radio', { name: 'Fun Emoji' }));
        fireEvent.keyDown(screen.getByRole('radio', { name: 'Notionists' }), {
            key: 'ArrowRight',
        });

        expect(onChange).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Fun Emoji' }),
        );
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.getByText('Style set by the administrator')).toBeTruthy();
    });

    it('falls back to initials when samples are missing and updates on rerender', async () => {
        class LoadedImage extends EventTarget {
            complete = false;
            naturalWidth = 8;
            referrerPolicy = '';
            crossOrigin: string | null = null;
            set src(_value: string) {
                queueMicrotask(() => {
                    this.complete = true;
                    this.dispatchEvent(new Event('load'));
                });
            }
        }
        vi.stubGlobal('Image', LoadedImage);
        const { rerender } = setup({ value: 'initials' });

        try {
            await waitFor(() => {
                expect(
                    screen
                        .getByRole('radio', { name: 'Notionists' })
                        .querySelector('img')
                        ?.getAttribute('src'),
                ).toBe('/avatars/11111111111111111111111111111111.svg');
            });
            const initialsTile = screen.getByRole('radio', {
                name: 'Initials',
            });
            expect(initialsTile.querySelector('img')).toBeNull();
            expect(initialsTile.textContent).toContain('AL');
        } finally {
            vi.unstubAllGlobals();
        }

        rerender(
            <AvatarStylePicker
                value="funEmoji"
                onChange={vi.fn()}
                options={options}
                sampleNames={names}
                allowMemberChoice
                onAllowMemberChoiceChange={vi.fn()}
            />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Fun Emoji' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
            'true',
        );
    });

    it('renders no member-choice switch in member mode, without the callback', () => {
        const { container } = renderWithProviders(
            <AvatarStylePicker
                value="notionists"
                onChange={vi.fn()}
                options={options}
                sampleNames={names}
            />,
        );

        expect(screen.queryByRole('switch')).toBeNull();
        expect(
            container.querySelector('[data-slot=avatar-style-member-choice]'),
        ).toBeNull();
        expect(screen.getAllByRole('radio')).toHaveLength(3);
    });
});
