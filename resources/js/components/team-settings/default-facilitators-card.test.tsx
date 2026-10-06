import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultFacilitatorsCard } from '@/components/team-settings/default-facilitators-card';
import { renderWithProviders } from '@/test/render';
import type { TeamFacilitatorsPanel } from '@/types';

type VisitOptions = {
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({ put: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en-GB' } }),
    router: { put: mocks.put },
}));

const camille = { id: 'u2', name: 'Camille Roux', avatarUrl: '' };
const ines = { id: 'u4', name: 'Inès Benali', avatarUrl: '' };
const arnaud = { id: 'u1', name: 'Arnaud Ritti', avatarUrl: '' };

const panel: TeamFacilitatorsPanel = {
    list: [camille, ines],
    rotation: true,
    suggested: { id: 'u4', name: 'Inès Benali' },
    candidates: [arnaud, camille, ines],
};

function card(
    facilitators: TeamFacilitatorsPanel = panel,
    nextRetro: { date: string; time: string | null } | null = {
        date: '2026-10-01',
        time: '14:00',
    },
) {
    return renderWithProviders(
        <DefaultFacilitatorsCard
            workspaceSlug="nordlys"
            team={{ id: 't1', name: 'Atlas' }}
            facilitators={facilitators}
            nextRetro={nextRetro}
        />,
    );
}

function section(): HTMLElement {
    return document.querySelector<HTMLElement>('section#facilitators')!;
}

function chips(): string[] {
    return Array.from(
        section().querySelectorAll('[data-slot="facilitator-chip"]'),
    ).map((chip) => chip.textContent ?? '');
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.put.mockReset();
});

describe('DefaultFacilitatorsCard', () => {
    it('shows the chips by first name, the rotation and who is suggested for the next retro', () => {
        card();

        expect(chips()).toEqual(['Camille', 'Inès']);
        expect(
            screen
                .getByRole('switch', {
                    name: 'Rotate the suggestion at every retro',
                })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(section().textContent).toContain(
            'Suggested next: Inès Benali · retro of 1 Oct',
        );
        expect(section().textContent).toContain(
            'The person creating a retro can always choose someone else.',
        );
    });

    it('names the suggestion alone without a next retro', () => {
        card(panel, null);

        expect(section().textContent).toContain('Suggested next: Inès Benali');
        expect(section().textContent).not.toContain('retro of');
    });

    it('offers the owners and facilitators not in the list, and saves the whole list in order', async () => {
        card();

        await userEvent.click(
            within(section()).getByRole('button', { name: 'Add' }),
        );

        expect(
            screen
                .getAllByRole('menuitem')
                .map((item) => item.querySelector('.truncate')?.textContent),
        ).toEqual(['Arnaud Ritti']);

        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Arnaud Ritti' }),
        );

        expect(mocks.put.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/facilitators',
        );
        expect(mocks.put.mock.calls[0][1]).toEqual({
            user_ids: ['u2', 'u4', 'u1'],
            rotation: true,
        });
        expect(chips()).toEqual(['Camille', 'Inès', 'Arnaud']);
    });

    it("shows each person's avatar in the list", async () => {
        card();

        await userEvent.click(
            within(section()).getByRole('button', { name: 'Add' }),
        );

        expect(
            screen
                .getByRole('menuitem', { name: 'Arnaud Ritti' })
                .querySelector('[data-slot="person-avatar"]'),
        ).not.toBeNull();
    });

    it('removes a chip, turns the rotation off with the last one, and restores the chips when the save fails', async () => {
        card({ ...panel, list: [camille] });

        await userEvent.click(
            screen.getByRole('button', { name: 'Remove person Camille Roux' }),
        );

        expect(mocks.put.mock.calls[0][1]).toEqual({
            user_ids: [],
            rotation: false,
        });
        expect(chips()).toEqual([]);

        await act(async () => {
            const options = mocks.put.mock.calls[0][2] as VisitOptions;

            options.onError?.({ user_ids: 'Something went wrong.' });
            options.onFinish?.();
        });

        expect(chips()).toEqual(['Camille']);
        expect(section().textContent).toContain('Something went wrong.');
    });

    it('saves the rotation switch with the list', async () => {
        card();

        await userEvent.click(
            screen.getByRole('switch', {
                name: 'Rotate the suggestion at every retro',
            }),
        );

        expect(mocks.put.mock.calls[0][1]).toEqual({
            user_ids: ['u2', 'u4'],
            rotation: false,
        });
    });

    it('disables the rotation while the list is empty', () => {
        card({ ...panel, list: [], rotation: false, suggested: null });

        expect(
            (
                screen.getByRole('switch', {
                    name: 'Rotate the suggestion at every retro',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(section().textContent).toContain('Add a facilitator first.');
        expect(section().textContent).not.toContain('Suggested next');
    });

    it('keeps showing the latest change while an earlier save finishes', async () => {
        card();

        await userEvent.click(
            screen.getByRole('button', { name: 'Remove person Camille Roux' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Remove person Inès Benali' }),
        );

        await act(async () => {
            (mocks.put.mock.calls[0][2] as VisitOptions).onFinish?.();
        });

        expect(chips()).toEqual([]);
    });

    it('ties a refusal to the rotation switch', async () => {
        card();

        await userEvent.click(
            screen.getByRole('switch', {
                name: 'Rotate the suggestion at every retro',
            }),
        );
        await act(async () => {
            const options = mocks.put.mock.calls[0][2] as VisitOptions;

            options.onError?.({ rotation: 'The rotation could not be saved.' });
            options.onFinish?.();
        });

        expect(
            screen
                .getByRole('switch', {
                    name: 'Rotate the suggestion at every retro',
                })
                .getAttribute('aria-describedby'),
        ).toContain(screen.getByRole('alert').id);
    });
});
