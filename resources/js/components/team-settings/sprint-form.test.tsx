import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SprintForm } from '@/components/team-settings/sprint-form';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ wide: true }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => mocks.wide }));

const draft = { number: 43, startsOn: '2026-10-05', endsOn: '2026-10-18' };

function form(
    onSubmit = vi.fn().mockResolvedValue(undefined),
    onOpenChange = vi.fn(),
    editing = false,
) {
    renderWithProviders(
        <SprintForm
            open
            onOpenChange={onOpenChange}
            title="Add a sprint"
            submitLabel="Add"
            initial={draft}
            editing={editing}
            onSubmit={onSubmit}
        />,
    );

    return { onSubmit, onOpenChange };
}

function field(id: string): HTMLInputElement {
    return document.querySelector<HTMLInputElement>(`#${id}`)!;
}

function description(element: HTMLElement): string {
    return (element.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim();
}

beforeEach(() => {
    mocks.wide = true;
});

describe('SprintForm', () => {
    it('opens prefilled in a dialog', () => {
        form();

        expect(
            screen
                .getByRole('dialog', { name: 'Add a sprint' })
                .getAttribute('data-slot'),
        ).toBe('dialog-content');
        expect(field('sprint-number').value).toBe('43');
        expect(field('sprint-starts-on').value).toBe('2026-10-05');
        expect(field('sprint-ends-on').value).toBe('2026-10-18');
    });

    it('opens in a drawer below 40rem', () => {
        mocks.wide = false;
        form();

        expect(
            screen
                .getByRole('dialog', { name: 'Add a sprint' })
                .getAttribute('data-slot'),
        ).toBe('drawer-content');
        expect(field('sprint-number').value).toBe('43');
    });

    it('posts the number and both days and closes', async () => {
        const user = userEvent.setup();
        const { onSubmit, onOpenChange } = form();

        await user.clear(field('sprint-number'));
        await user.type(field('sprint-number'), '44');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(onSubmit).toHaveBeenCalledWith({
            number: 44,
            startsOn: '2026-10-05',
            endsOn: '2026-10-18',
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows each error under its field and stays open', async () => {
        const user = userEvent.setup();
        const { onOpenChange } = form(
            vi.fn().mockRejectedValue({
                number: 'Sprint 43 already exists.',
                starts_on: 'This sprint overlaps Sprint 42 (21 Sep – 4 Oct).',
            }),
        );

        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(field('sprint-number').getAttribute('aria-invalid')).toBe(
            'true',
        );
        expect(description(field('sprint-number'))).toBe(
            'Sprint 43 already exists.',
        );
        expect(description(field('sprint-starts-on'))).toBe(
            'This sprint overlaps Sprint 42 (21 Sep – 4 Oct).',
        );
        expect(field('sprint-ends-on').hasAttribute('aria-invalid')).toBe(
            false,
        );
        expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it('disables the submit button while saving', async () => {
        const user = userEvent.setup();

        form(vi.fn().mockReturnValue(new Promise(() => undefined)));

        await user.click(screen.getByRole('button', { name: 'Add' }));

        expect(
            (screen.getByRole('button', { name: /Add/ }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('says that editing the days relabels sessions', () => {
        form(undefined, undefined, true);

        expect(
            screen.getByRole('dialog', { name: 'Add a sprint' }).textContent,
        ).toContain("Sessions created in these days take this sprint's label.");
    });
});
