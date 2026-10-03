import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { BreachLine, BreachLineId } from './breach-line';
import type { BreachState } from './use-breach-check';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

function line(state: BreachState, live = true, checks = true) {
    return renderWithProviders(
        <ul>
            <BreachLine
                state={state}
                liveBreachCheck={live}
                checksCompromisedPasswords={checks}
            />
        </ul>,
    );
}

function item(): HTMLElement {
    return screen.getByRole('listitem');
}

describe('BreachLine', () => {
    it('states the rule without a mark while nothing is typed', () => {
        line('idle');

        expect(item().textContent).toBe('Not found in known data breaches');
        expect(item().dataset.state).toBe('idle');
        expect(item().dataset.met).toBeUndefined();
    });

    it('turns a spinner that rests when animations are reduced while checking', () => {
        line('checking');

        expect(item().textContent).toContain('Checking known data breaches…');
        expect(
            item()
                .querySelector('[data-slot="breach-spinner"]')
                ?.getAttribute('class'),
        ).toContain('motion-reduce:animate-none');
    });

    it('marks the rule as met when the range lacks the password', () => {
        line('clear');

        expect(item().textContent).toBe(
            'Not found in known data breaches(met)',
        );
        expect(item().dataset.met).toBe('true');
    });

    it('marks the rule as not met, with the line the field points at, when the password is breached', () => {
        line('breached');

        expect(item().textContent).toBe(
            'Found in known data breaches: choose another one',
        );
        expect(item().dataset.met).toBe('false');
        expect(item().id).toBe(BreachLineId);
    });

    it.each([
        ['the live check is unavailable', 'unavailable' as const, true],
        ['the instance does not check live', 'clear' as const, false],
    ])('says the check runs on save when %s', (_, state, live) => {
        line(state, live);

        expect(item().textContent).toBe(
            'Checked against known data breaches when you save',
        );
    });

    it('says nothing when the server does not check', () => {
        line('breached', true, false);

        expect(screen.queryByRole('listitem')).toBeNull();
    });
});
