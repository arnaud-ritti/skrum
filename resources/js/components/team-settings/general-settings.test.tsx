import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { GeneralSettings } from './general-settings';

type VisitOptions = {
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({
    patch: vi.fn(),
    delete: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: {
            patch: mocks.patch,
            delete: mocks.delete,
        },
    };
});

beforeEach(() => {
    mocks.patch.mockReset();
    mocks.delete.mockReset();
});

function general(canDelete = true) {
    return renderWithProviders(
        <GeneralSettings
            workspaceSlug="nordlys"
            team={{ id: 'team-1', name: 'Atlas', description: 'Product squad' }}
            canDelete={canDelete}
        />,
    );
}

describe('GeneralSettings', () => {
    it('is the Team card with the name, the description and its help line', () => {
        general();

        const name = screen.getByLabelText('Name') as HTMLInputElement;
        const description = screen.getByLabelText(
            'Description',
        ) as HTMLTextAreaElement;

        expect(screen.getByRole('region', { name: 'Team' })).not.toBeNull();
        expect(name.id).toBe('team-name');
        expect(name.value).toBe('Atlas');
        expect(name.maxLength).toBe(100);
        expect(description.id).toBe('team-description');
        expect(description.value).toBe('Product squad');
        expect(description.maxLength).toBe(200);
        expect(description.getAttribute('aria-describedby')).toBe(
            screen.getByText('Shown on the workspace page.').id,
        );
    });

    it('saves both fields to the team', async () => {
        general();

        fireEvent.change(screen.getByLabelText('Name'), {
            target: { value: 'Borealis' },
        });
        fireEvent.change(screen.getByLabelText('Description'), {
            target: { value: 'Nordic squad' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await act(async () => {});

        expect(mocks.patch).toHaveBeenCalledTimes(1);
        expect(mocks.patch.mock.calls[0][0]).toBe('/w/nordlys/teams/team-1');
        expect(mocks.patch.mock.calls[0][1]).toEqual({
            name: 'Borealis',
            description: 'Nordic squad',
        });
    });

    it('shows the server error under the field it belongs to', async () => {
        mocks.patch.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({
                    description:
                        'The description field must not be greater than 200 characters.',
                });
                options.onFinish?.();
            },
        );

        general();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await act(async () => {});

        const description = screen.getByLabelText('Description');
        const error = screen.getByText(
            'The description field must not be greater than 200 characters.',
        );

        expect(description.getAttribute('aria-invalid')).toBe('true');
        expect(description.getAttribute('aria-describedby')).toContain(
            error.id,
        );
        expect(
            screen.getByLabelText('Name').getAttribute('aria-invalid'),
        ).toBeNull();
    });

    it('offers to delete the team to who may', () => {
        general(true);

        expect(
            screen.getByRole('button', { name: 'Delete team' }),
        ).not.toBeNull();
    });

    it('has no delete card for who may not delete the team', () => {
        general(false);

        expect(
            screen.queryByRole('button', { name: 'Delete team' }),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="team-settings"]'),
        ).toBeNull();
    });

    describe('the team link (decision 7 B)', () => {
        function withSlug() {
            return renderWithProviders(
                <GeneralSettings
                    workspaceSlug="nordlys"
                    team={{
                        id: 'team-1',
                        name: 'Atlas',
                        description: null,
                        slug: 'atlas',
                        address: 'https://skrum.test/t/atlas',
                    }}
                    canDelete={false}
                />,
            );
        }

        it('shows the team address under the name without the scheme, as step 2 does, the slug not following the name', () => {
            withSlug();

            fireEvent.change(screen.getByLabelText('Name'), {
                target: { value: 'Borealis' },
            });

            const field = document.querySelector(
                '[data-slot="team-address-field"]',
            );

            expect(field?.textContent).toContain('skrum.test/t/');
            expect(field?.textContent).not.toContain('https://');
            expect(
                field?.querySelector('[data-slot="team-address-slug"]')
                    ?.textContent,
            ).toBe('atlas');
        });

        it('sends the unchanged slug with a rename', async () => {
            withSlug();

            fireEvent.change(screen.getByLabelText('Name'), {
                target: { value: 'Borealis' },
            });
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            await act(async () => {});

            expect(mocks.patch.mock.calls[0][1]).toEqual({
                name: 'Borealis',
                description: '',
                slug: 'atlas',
            });
        });

        it('sends an edited slug and shows its server error', async () => {
            mocks.patch.mockImplementation(
                (_url: string, _data: unknown, options: VisitOptions) => {
                    options.onError?.({
                        slug: 'This link is already taken in Nordlys.',
                    });
                    options.onFinish?.();
                },
            );
            withSlug();

            fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
            fireEvent.change(screen.getByLabelText('Team link'), {
                target: { value: 'boreal' },
            });
            fireEvent.click(screen.getByRole('button', { name: 'Save' }));
            await act(async () => {});

            expect(mocks.patch.mock.calls[0][1]).toMatchObject({
                slug: 'boreal',
            });
            expect(
                screen.getByText('This link is already taken in Nordlys.'),
            ).not.toBeNull();
        });
    });
});
