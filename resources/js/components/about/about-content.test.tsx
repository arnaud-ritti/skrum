import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AboutContent } from '@/components/about/about-content';
import type { AboutContentProps } from '@/components/about/about-content';
import { renderWithProviders } from '@/test/render';

const base: AboutContentProps = {
    name: 'Nordlys Rituals',
    version: '1.8.0',
    poweredBy: true,
    attributions: {
        avatarStyles: [
            {
                style: 'fun-emoji',
                name: 'Fun Emoji',
                source: 'Fun Emoji Set',
                creator: 'Davis Uche',
                license: 'CC BY 4.0',
                sourceUrl: 'https://example.com/fun-emoji',
            },
            {
                style: 'personas',
                name: 'Personas',
                source: 'Personas by Draftbit',
                creator: 'Draftbit',
                license: 'CC BY 4.0',
                sourceUrl: null,
            },
        ],
        gifProvider: 'tenor',
    },
};

describe('AboutContent', () => {
    it('links to documentation, source code and project support', () => {
        renderWithProviders(<AboutContent {...base} />);

        for (const [name, href] of [
            ['Documentation', 'https://arnaud-ritti.github.io/skrum/docs/'],
            ['Source code', 'https://github.com/arnaud-ritti/skrum'],
            ['GitHub Sponsors', 'https://github.com/sponsors/arnaud-ritti'],
            ['Ko-fi', 'https://ko-fi.com/arnaudritti'],
        ]) {
            const link = screen.getByRole('link', { name });

            expect(link.getAttribute('href')).toBe(href);
            expect(link.getAttribute('target')).toBe('_blank');
            expect(link.getAttribute('rel')).toBe('noreferrer noopener');
        }
    });

    it('shows the product name and the version', () => {
        renderWithProviders(<AboutContent {...base} />);

        expect(
            screen.getByRole('heading', { level: 1, name: 'Nordlys Rituals' }),
        ).toBeTruthy();
        expect(screen.getByText('Version 1.8.0')).toBeTruthy();
    });

    it('shows "Powered by Skrüm" only when the instance keeps it', () => {
        const { unmount } = renderWithProviders(<AboutContent {...base} />);

        expect(screen.getByText('Powered by Skrüm')).toBeTruthy();

        unmount();
        renderWithProviders(<AboutContent {...base} poweredBy={false} />);

        expect(screen.queryByText('Powered by Skrüm')).toBeNull();
    });

    it('lists each attribution with its style, source, creator and licence', () => {
        renderWithProviders(<AboutContent {...base} />);

        const rows = screen.getAllByRole('listitem');

        expect(rows).toHaveLength(2);
        expect(within(rows[0]).getByText('Fun Emoji')).toBeTruthy();
        expect(
            within(rows[0]).getByText('Fun Emoji Set by Davis Uche'),
        ).toBeTruthy();
        expect(within(rows[0]).getByText('CC BY 4.0')).toBeTruthy();
        expect(
            within(rows[1]).getByText('Personas by Draftbit by Draftbit'),
        ).toBeTruthy();
    });

    it('opens the source in a new tab without leaking the opener or the referrer', () => {
        renderWithProviders(<AboutContent {...base} />);

        const link = screen.getByRole('link', {
            name: 'Source of Fun Emoji (opens in a new tab)',
        });

        expect(link.getAttribute('href')).toBe('https://example.com/fun-emoji');
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noreferrer noopener');
    });

    it('renders no link for an attribution without a source address', () => {
        renderWithProviders(<AboutContent {...base} />);

        expect(
            within(screen.getAllByRole('listitem')[1]).queryByRole('link'),
        ).toBeNull();
    });

    it('says that nothing needs attribution when the list is empty', () => {
        renderWithProviders(
            <AboutContent
                {...base}
                attributions={{ avatarStyles: [], gifProvider: null }}
            />,
        );

        expect(
            screen.getByText('The avatar style in use needs no attribution.'),
        ).toBeTruthy();
        expect(screen.queryByRole('listitem')).toBeNull();
    });

    it('credits the GIF provider only when there is one', () => {
        const { unmount } = renderWithProviders(<AboutContent {...base} />);

        expect(screen.getByText('Powered by Tenor')).toBeTruthy();

        unmount();
        renderWithProviders(
            <AboutContent
                {...base}
                attributions={{ ...base.attributions, gifProvider: null }}
            />,
        );

        expect(screen.queryByText(/^Powered by (Tenor|GIPHY)$/)).toBeNull();
    });
});
