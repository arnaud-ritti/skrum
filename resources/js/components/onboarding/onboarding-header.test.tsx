import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    OnboardingProgress,
    OnboardingStepper,
} from '@/components/onboarding/onboarding-header';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

describe('OnboardingProgress', () => {
    it('stands halfway through the current step, as drawn', () => {
        renderWithProviders(<OnboardingProgress step="team" />);

        const bar = screen.getByRole('progressbar', { name: 'Step 2 of 4' });
        const indicator = bar.querySelector<HTMLElement>(
            '[data-slot="progress-indicator"]',
        );

        expect(bar.getAttribute('aria-valuetext')).toBe('Step 2 of 4');
        expect(indicator?.style.width).toBe('37.5%');
    });
});

describe('OnboardingStepper', () => {
    it('is a read-only list of the four steps', () => {
        renderWithProviders(<OnboardingStepper step="invite" />);

        expect(screen.getByRole('list', { name: 'Steps' })).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
        expect(
            document.querySelector('[aria-current="step"]')?.textContent,
        ).toBe('3Invite');
    });
});
