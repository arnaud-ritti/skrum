import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProviderMark } from '@/components/skrum/provider-mark';

describe('ProviderMark', () => {
    it('draws the brand mark in its brand colour, hidden from assistive tech', () => {
        const { container } = render(<ProviderMark provider="jira" />);
        const svg = container.querySelector('svg');

        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(svg?.getAttribute('data-provider-mark')).toBe('jira');
        expect(svg?.getAttribute('fill')).toBe('#0052CC');
    });

    it('draws the same mark for Jira Data Center as for Jira', () => {
        const { container } = render(<ProviderMark provider="jira_dc" />);

        expect(
            container.querySelector('svg')?.getAttribute('data-provider-mark'),
        ).toBe('jira');
    });

    it('draws the multicolour marks of Slack, Microsoft Teams and Microsoft', () => {
        for (const provider of ['slack', 'msteams', 'entra']) {
            const { container, unmount } = render(
                <ProviderMark provider={provider} />,
            );

            expect(
                container
                    .querySelector('svg')
                    ?.getAttribute('data-provider-mark'),
            ).toBe(provider);

            unmount();
        }
    });

    it('falls back to the letter tile of the label for a provider without a mark', () => {
        const { container } = render(
            <ProviderMark provider="acme" label="acme tracker" />,
        );
        const tile = container.querySelector('[data-provider-mark="letter"]');

        expect(tile?.textContent).toBe('A');
        expect(tile?.getAttribute('aria-hidden')).toBe('true');
    });
});
