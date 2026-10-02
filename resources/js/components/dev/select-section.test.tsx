import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import SelectSection from '@/pages/dev/sections/select';
import { renderWithProviders } from '@/test/render';

beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.ResizeObserver ??= class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    };
});

describe('select bench section', () => {
    it('renders the open lists together', async () => {
        renderWithProviders(<SelectSection />);

        expect(await screen.findAllByRole('listbox')).not.toHaveLength(0);
    });
});
