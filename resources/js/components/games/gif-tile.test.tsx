import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GifTile } from './gif-tile';

const Gif = {
    id: 'partyone',
    previewUrl: '/gifs/partyone/preview',
    url: '/gifs/partyone/full',
};

describe('GifTile', () => {
    it('is a figure whose first image is the GIF, named by its caption', () => {
        render(
            <GifTile
                gif={Gif}
                caption="by Ada"
                author={{ name: 'Ada', avatarUrl: null, isGuest: false }}
            >
                <span>Votes: 1</span>
            </GifTile>,
        );

        const figure = screen.getByRole('figure');

        expect(figure.querySelector('img')?.getAttribute('src')).toBe(
            '/gifs/partyone/preview',
        );
        expect(figure.querySelector('figcaption')?.textContent).toBe('by Ada');
        expect(figure.textContent).toContain('Votes: 1');
        expect(figure.hasAttribute('data-winner')).toBe(false);
        expect(screen.queryByText('Winner')).toBeNull();
        expect(
            figure.querySelector('[data-slot="person-avatar"]')?.textContent,
        ).toBe('A');
    });

    it("shows the sender's caption under the GIF, as its text alternative", () => {
        render(
            <GifTile gif={Gif} caption="by Ada" description="CI on Friday" />,
        );

        const figure = screen.getByRole('figure');

        expect(figure.querySelector('img')?.getAttribute('alt')).toBe(
            'CI on Friday',
        );
        expect(screen.getByText('CI on Friday')).toBeTruthy();
    });

    it('carries the "Winner" mark of the mockup when it won', () => {
        render(<GifTile gif={Gif} caption="by Ada" winner />);

        expect(screen.getByRole('figure').hasAttribute('data-winner')).toBe(
            true,
        );
        expect(screen.getByText('Winner')).toBeTruthy();
    });
});
