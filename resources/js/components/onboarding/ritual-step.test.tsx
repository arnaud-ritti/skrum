import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RitualStep } from '@/components/onboarding/ritual-step';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { post: mocks.post },
}));

beforeEach(() => {
    mocks.post.mockReset();
});

describe('RitualStep', () => {
    it('offers the four rituals, the retro chosen', () => {
        renderWithProviders(<RitualStep />);

        const group = screen.getByRole('radiogroup', {
            name: 'What do you want to start with?',
        });

        expect(group).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(4);
        expect(
            screen
                .getByRole('radio', { name: /Retrospective/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByText('Writing → vote → actions')).toBeTruthy();
        expect(screen.queryByText('When · optional')).toBeNull();
    });

    it('names the primary button after the chosen type and posts it', async () => {
        const user = userEvent.setup();
        renderWithProviders(<RitualStep />);

        expect(
            screen.getByRole('button', { name: 'Create the retro' }),
        ).toBeTruthy();

        await user.click(screen.getByRole('radio', { name: /Planning poker/ }));
        expect(
            screen.getByRole('button', { name: 'Create the poker game' }),
        ).toBeTruthy();

        await user.click(screen.getByRole('radio', { name: /Whiteboard/ }));
        expect(
            screen.getByRole('button', { name: 'Create the whiteboard' }),
        ).toBeTruthy();

        await user.click(screen.getByRole('radio', { name: /Icebreaker/ }));
        await user.click(
            screen.getByRole('button', { name: 'Create the icebreaker' }),
        );

        expect(mocks.post).toHaveBeenCalledOnce();
        expect(mocks.post.mock.calls[0][0]).toBe('/onboarding/completion');
        expect(mocks.post.mock.calls[0][1]).toEqual({ ritual: 'icebreaker' });
    });

    it('completes without a ritual from "Go to the dashboard instead"', async () => {
        const user = userEvent.setup();
        renderWithProviders(<RitualStep />);

        await user.click(
            screen.getByRole('button', { name: 'Go to the dashboard instead' }),
        );

        expect(mocks.post.mock.calls[0][1]).toEqual({});
    });

    it('shows the step refusal of "Create the retro"', async () => {
        mocks.post.mockImplementation(
            (
                _url: string,
                _data: unknown,
                options: { onError?: (errors: Record<string, string>) => void },
            ) => options.onError?.({ step: 'This step is not available.' }),
        );
        const user = userEvent.setup();
        renderWithProviders(<RitualStep />);

        await user.click(
            screen.getByRole('button', { name: 'Create the retro' }),
        );

        expect(screen.getByText('This step is not available.')).toBeTruthy();
    });
});
