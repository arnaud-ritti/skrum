import { screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import SelectSection from '@/pages/dev/sections/select';
import { renderWithProviders } from '@/test/render';

const { scrollIntoView } = window.HTMLElement.prototype;

beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
});

describe('select bench section', () => {
    it('renders the open select and the open combobox together', async () => {
        renderWithProviders(<SelectSection />);

        expect(
            await screen.findAllByRole('listbox', { hidden: true }),
        ).toHaveLength(2);
    });
});
