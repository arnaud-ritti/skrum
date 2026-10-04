import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamStep } from '@/components/onboarding/team-step';
import type { TeamDraft } from '@/components/onboarding/team-step';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onStart?: () => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({ put: vi.fn(), post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { put: mocks.put, post: mocks.post },
}));

beforeEach(() => {
    mocks.put.mockReset();
    mocks.post.mockReset();
});

const empty: TeamDraft = {
    name: '',
    color: 'lagoon',
    slug: '',
    slugEdited: false,
    description: '',
};

function Harness({
    initial = empty,
    canGoBack = true,
}: {
    initial?: TeamDraft;
    canGoBack?: boolean;
}) {
    const [draft, setDraft] = useState(initial);

    return (
        <TeamStep
            draft={draft}
            onDraftChange={setDraft}
            addressBase="skrum.test/t/"
            workspaceName="Nordlys"
            canGoBack={canGoBack}
        />
    );
}

function lastPut(): [string, Record<string, unknown>, VisitOptions] {
    return mocks.put.mock.calls.at(-1) as [
        string,
        Record<string, unknown>,
        VisitOptions,
    ];
}

describe('TeamStep', () => {
    it('renders the fields and the actions as drawn', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('Step 2 of 4')).toBeTruthy();
        expect(
            screen.getByRole('heading', { name: 'Create your first team' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'A team is the people who run their rituals together. You can add more teams to Nordlys later.',
            ),
        ).toBeTruthy();
        expect(screen.getByLabelText('Team name')).toBeTruthy();
        expect(
            screen.getAllByRole('radio').map((radio) => radio.dataset.color),
        ).toEqual([
            'moss',
            'coral',
            'sun',
            'plum',
            'sky',
            'lagoon',
            'iris',
            'apricot',
        ]);
        expect(screen.getByText('Team link')).toBeTruthy();
        expect(screen.getByLabelText('Description · optional')).toBeTruthy();
        expect(
            screen
                .getAllByRole('button')
                .map((button) => button.textContent)
                .filter((text) =>
                    ['Back', 'Skip for now', 'Continue'].includes(text ?? ''),
                ),
        ).toEqual(['Back', 'Skip for now', 'Continue']);
        expect(
            screen.getByText(
                'Everything can be changed later in Team settings.',
            ),
        ).toBeTruthy();
    });

    it('names the chosen colour under the swatches', () => {
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('radio', { name: 'Plum' }));

        expect(
            screen
                .getByRole('radio', { name: 'Plum' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(screen.getByText('Plum')).toBeTruthy();
    });

    it('sends no slug until "Edit" was used, then the typed one', () => {
        renderWithProviders(<Harness />);

        fireEvent.change(screen.getByLabelText('Team name'), {
            target: { value: 'Atlas' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(lastPut()[0]).toBe('/onboarding/team');
        expect(lastPut()[1]).toEqual({
            name: 'Atlas',
            color: 'lagoon',
            description: '',
        });

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Team link'), {
            target: { value: 'atlas-squad' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(lastPut()[1]).toEqual({
            name: 'Atlas',
            color: 'lagoon',
            description: '',
            slug: 'atlas-squad',
        });
    });

    it('shows a field error from the server under its field', () => {
        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({
                    slug: 'This link is already taken in Nordlys.',
                    name: 'The name field is required.',
                });
            },
        );
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(
            screen.getByText('This link is already taken in Nordlys.'),
        ).toBeTruthy();
        expect(
            screen.getByLabelText('Team name').getAttribute('aria-invalid'),
        ).toBe('true');
    });

    it('ties a colour error to the swatches', () => {
        mocks.put.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({ color: 'The selected color is invalid.' });
            },
        );
        renderWithProviders(<Harness />);

        const group = screen.getByRole('radiogroup', { name: 'Team colour' });

        expect(group.getAttribute('aria-invalid')).toBeNull();
        expect(group.getAttribute('aria-describedby')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(group.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(
                group.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('The selected color is invalid.');
    });

    it('goes back to the workspace step with "Back"', () => {
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(lastPut()[0]).toBe('/onboarding/step');
        expect(lastPut()[1]).toEqual({ step: 'workspace' });
    });

    it('offers no "Back" when the workspace cannot be edited', () => {
        renderWithProviders(<Harness canGoBack={false} />);

        expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Skip for now' }),
        ).toBeTruthy();
    });

    it('ends the onboarding with "Skip for now", with no ritual', () => {
        renderWithProviders(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

        expect(mocks.post).toHaveBeenCalledOnce();
        expect(mocks.post.mock.calls[0][0]).toBe('/onboarding/completion');
        expect(mocks.post.mock.calls[0][1]).toEqual({});
    });

    it('shows a saved slug as edited after a "Back"', () => {
        renderWithProviders(
            <Harness
                initial={{
                    ...empty,
                    name: 'Atlas',
                    slug: 'atlas-crew',
                    slugEdited: true,
                }}
            />,
        );

        fireEvent.change(screen.getByLabelText('Team name'), {
            target: { value: 'Borealis' },
        });

        expect(
            document.querySelector('[data-slot="team-address-slug"]')
                ?.textContent,
        ).toBe('atlas-crew');
    });
});
