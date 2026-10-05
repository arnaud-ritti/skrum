import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import {
    estimatePasswordStrength,
    parsePasswordRules,
    PasswordBreachCheck,
    PasswordRules,
    PasswordStrength,
} from './password-strength';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {} };
});

function segmentsOn(): number {
    return screen
        .getByRole('meter')
        .querySelectorAll('[data-slot="password-strength-segment"][data-on]')
        .length;
}

describe('estimatePasswordStrength', () => {
    it('gives nothing for an empty field', () => {
        expect(estimatePasswordStrength('')).toEqual({ score: 0, level: null });
    });

    it('calls a short or a plain password weak', () => {
        expect(estimatePasswordStrength('abc12')).toEqual({
            score: 1,
            level: 'weak',
        });
        expect(estimatePasswordStrength('abcdefghij')).toEqual({
            score: 2,
            level: 'weak',
        });
    });

    it('calls a long or a varied password good', () => {
        expect(estimatePasswordStrength('abcdefghijklmn')).toEqual({
            score: 3,
            level: 'good',
        });
        expect(estimatePasswordStrength('Abcdefg1')).toEqual({
            score: 3,
            level: 'good',
        });
    });

    it('calls a long password with every kind of character strong, as two more characters do', () => {
        expect(estimatePasswordStrength('Abcdefghijk1!')).toEqual({
            score: 4,
            level: 'strong',
        });
        expect(estimatePasswordStrength('Abcdefghijklmn12')).toEqual({
            score: 4,
            level: 'strong',
        });
    });
});

describe('estimatePasswordStrength against the rule of the server', () => {
    it('calls weak a password shorter than the server accepts', () => {
        expect(estimatePasswordStrength('Abcdefg1', 12)).toEqual({
            score: 1,
            level: 'weak',
        });
    });

    it('calls a long run of one kind of character good, not strong', () => {
        expect(estimatePasswordStrength('a'.repeat(20))).toEqual({
            score: 3,
            level: 'good',
        });
    });
});

describe('PasswordStrength', () => {
    it('is an empty meter without a label while nothing is typed', () => {
        renderWithProviders(<PasswordStrength password="" />);

        const meter = screen.getByRole('meter', { name: 'Password strength' });

        expect(meter.getAttribute('aria-valuemin')).toBe('0');
        expect(meter.getAttribute('aria-valuemax')).toBe('4');
        expect(meter.getAttribute('aria-valuenow')).toBe('0');
        expect(segmentsOn()).toBe(0);
        expect(
            document.querySelector('[data-slot="password-strength-label"]'),
        ).toBeNull();
    });

    it('shows the weak level in words, not only in colour', () => {
        renderWithProviders(<PasswordStrength password="abc12" />);

        expect(segmentsOn()).toBe(1);
        expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
            'Weak',
        );
        expect(
            document.querySelector('[data-slot="password-strength-label"]')
                ?.textContent,
        ).toBe('Weak — add characters, and mix letters, numbers and symbols.');
    });

    it('shows the good level on three segments, with what makes it strong', () => {
        renderWithProviders(<PasswordStrength password="abcdefghijklmn" />);

        expect(segmentsOn()).toBe(3);
        expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe(
            '3',
        );
        expect(
            document.querySelector('[data-slot="password-strength-label"]')
                ?.textContent,
        ).toBe('Good — add a symbol or more characters to make it strong.');
    });

    it('shows the strong level on the four segments', () => {
        renderWithProviders(<PasswordStrength password="Abcdefghijk1!" />);

        expect(segmentsOn()).toBe(4);
        expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
            'Strong',
        );
    });
});

describe('parsePasswordRules', () => {
    it('reads the rule string the server sends', () => {
        expect(
            parsePasswordRules(
                'minlength: 12; required: lower; required: upper; required: digit; required: special;',
            ),
        ).toEqual([
            { kind: 'minlength', count: 12 },
            { kind: 'required', characters: 'lower' },
            { kind: 'required', characters: 'upper' },
            { kind: 'required', characters: 'digit' },
            { kind: 'required', characters: 'special' },
        ]);
    });

    it('ignores what it does not know', () => {
        expect(parsePasswordRules('minlength: 8; allowed: ascii;')).toEqual([
            { kind: 'minlength', count: 8 },
        ]);
    });
});

describe('PasswordRules', () => {
    it("states the server's rule and marks each part as the password meets it", () => {
        renderWithProviders(
            <PasswordRules
                rules="minlength: 12; required: lower; required: upper; required: digit; required: special;"
                password="Abcdefgh"
            />,
        );

        const items = within(
            screen.getByRole('list', { name: 'Password rules' }),
        ).getAllByRole('listitem');

        expect(items.map((item) => item.textContent)).toEqual([
            'At least 12 characters(not met yet)',
            'A lowercase letter(met)',
            'An uppercase letter(met)',
            'A number(not met yet)',
            'A symbol(not met yet)',
        ]);
        expect(items.map((item) => item.getAttribute('data-met'))).toEqual([
            'false',
            'true',
            'true',
            'false',
            'false',
        ]);
    });

    it('never states a rule the server does not have', () => {
        renderWithProviders(
            <PasswordRules rules="minlength: 8;" password="" />,
        );

        expect(
            screen.getAllByRole('listitem').map((item) => item.textContent),
        ).toEqual(['At least 8 characters(not met yet)']);
    });

    it('leaves the end of the list to the breach check', () => {
        renderWithProviders(
            <PasswordRules
                rules="minlength: 8;"
                password=""
                breachCheck={<li>Not found in known data breaches</li>}
            />,
        );

        expect(screen.getAllByRole('listitem').at(-1)?.textContent).toBe(
            'Not found in known data breaches',
        );
    });

    it('says the breach check runs on save, without a met or not met mark', () => {
        renderWithProviders(
            <PasswordRules
                rules="minlength: 8;"
                password=""
                breachCheck={<PasswordBreachCheck />}
            />,
        );

        expect(screen.getAllByRole('listitem').at(-1)?.textContent).toBe(
            'Checked against known data breaches when you save',
        );
    });
});

describe('PasswordStrength, announced', () => {
    it('keeps its live region mounted before anything is typed, so the first level is announced', () => {
        const view = renderWithProviders(<PasswordStrength password="" />);
        const live = document.querySelector(
            '[data-slot="password-strength-live"]',
        );

        expect(live?.getAttribute('aria-live')).toBe('polite');
        expect(live?.textContent).toBe('');

        view.rerender(<PasswordStrength password="abc12" />);

        expect(
            document.querySelector('[data-slot="password-strength-live"]'),
        ).toBe(live);
        expect(live?.textContent).toContain('Weak');
    });
});
