import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AvatarStyleGrid } from './avatar-style-grid';
import type { AdminAvatarStyle } from './branding';

const values = [
    'adventurer',
    'fun-emoji',
    'glass',
    'initials',
    'lorelei',
    'notionists',
    'pixel-art',
    'shapes',
    'thumbs',
];

const options: AdminAvatarStyle[] = values.map((value) => ({
    value,
    name: value,
    license: value === 'fun-emoji' ? 'CC BY 4.0' : 'CC0 1.0',
    attribution: null,
    attributionRequired: false,
    sampleUrls: [],
}));

function Harness({ initial }: { initial: string }) {
    const [value, setValue] = useState(initial);
    const [allow, setAllow] = useState(false);

    return (
        <AvatarStyleGrid
            value={value}
            onChange={setValue}
            options={options}
            sampleName="Ada Admin"
            allowMemberChoice={allow}
            onAllowMemberChoiceChange={setAllow}
        />
    );
}

function tiles(): string[] {
    return screen
        .getAllByRole('radio')
        .map(
            (tile) =>
                document.getElementById(
                    tile.getAttribute('aria-labelledby') ?? '',
                )?.textContent ?? '',
        );
}

describe('AvatarStyleGrid', () => {
    it('shows the seven styles of the short list in the order of the mockup', () => {
        renderWithProviders(<Harness initial="thumbs" />);

        expect(tiles()).toEqual([
            'initials',
            'notionists',
            'thumbs',
            'lorelei',
            'glass',
            'shapes',
            'fun-emoji',
        ]);
        expect(
            screen
                .getByRole('radio', { name: 'thumbs' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('expands the full list from the entry that counts the styles', () => {
        renderWithProviders(<Harness initial="thumbs" />);

        const more = screen.getByRole('button', { name: '9 styles' });

        expect(more.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(more);

        expect(more.getAttribute('aria-expanded')).toBe('true');
        expect(tiles()).toEqual(values);

        fireEvent.click(screen.getByRole('radio', { name: 'pixel-art' }));
        fireEvent.click(more);

        expect(tiles()).toContain('pixel-art');
        expect(tiles()).toHaveLength(8);
    });

    it('keeps a selected style outside the short list among the tiles', () => {
        renderWithProviders(<Harness initial="adventurer" />);

        expect(tiles()).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'adventurer' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('states the licence as the title of the tile', () => {
        renderWithProviders(<Harness initial="thumbs" />);

        expect(screen.getByRole('radio', { name: 'fun-emoji' }).title).toBe(
            'CC BY 4.0',
        );
    });

    it('moves the selection with the arrow keys', () => {
        renderWithProviders(<Harness initial="initials" />);

        fireEvent.keyDown(screen.getByRole('radio', { name: 'initials' }), {
            key: 'ArrowRight',
        });

        expect(
            screen
                .getByRole('radio', { name: 'notionists' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'notionists' }),
        );
    });

    it('lets the admin allow members to choose their own style', () => {
        renderWithProviders(<Harness initial="thumbs" />);

        const choice = screen.getByRole('switch', {
            name: 'Members can choose their own style',
        });

        fireEvent.click(choice);

        expect(choice.getAttribute('aria-checked')).toBe('true');
    });
});
