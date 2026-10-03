import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ConfettiPieces,
    SessionConfetti,
} from '@/components/retro/session-confetti';

const original = window.matchMedia;

function prefersReducedMotion(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
}

const pieces = () => [
    ...document.querySelectorAll<HTMLElement>(
        '[data-slot="session-confetti"] > span',
    ),
];

afterEach(() => {
    window.matchMedia = original;
    document.documentElement.classList.remove('reduce-motion');
});

describe('SessionConfetti', () => {
    it('throws forty pieces once, hidden from assistive technology, each with its own flight', () => {
        prefersReducedMotion(false);

        render(<SessionConfetti colors={['moss', 'coral']} />);

        const layer = document.querySelector(
            '[data-slot="session-confetti"]',
        ) as HTMLElement;

        expect(layer.getAttribute('aria-hidden')).toBe('true');
        expect(layer.className).toContain('pointer-events-none');
        expect(layer.className).toContain('motion-reduce:hidden');
        expect(pieces()).toHaveLength(ConfettiPieces);
        expect(ConfettiPieces).toBe(40);

        for (const piece of pieces()) {
            expect(piece.className).toContain('animate-confetti');
            expect(piece.style.getPropertyValue('--dx')).toMatch(/rem$/);
            expect(piece.style.getPropertyValue('--dy')).toMatch(/rem$/);
            expect(piece.style.getPropertyValue('--rot')).toMatch(/deg$/);
        }
    });

    it('takes the colours of the columns of the session', () => {
        prefersReducedMotion(false);

        render(<SessionConfetti colors={['moss', 'coral']} />);

        const classes = pieces().map((piece) => piece.className);

        expect(classes.some((name) => name.includes('col-moss'))).toBe(true);
        expect(classes.some((name) => name.includes('col-coral'))).toBe(true);
        expect(classes.some((name) => name.includes('col-sun'))).toBe(false);
    });

    it('mixes sticky notes and pairs of dots', () => {
        prefersReducedMotion(false);

        render(<SessionConfetti colors={[]} />);

        const shapes = new Set(pieces().map((piece) => piece.dataset.shape));

        expect(
            [...shapes].sort((a, b) => (a ?? '').localeCompare(b ?? '')),
        ).toEqual(['note', 'trema']);
    });

    it('renders nothing for a viewer who prefers reduced motion', () => {
        prefersReducedMotion(true);

        render(<SessionConfetti colors={['moss']} />);

        expect(
            document.querySelector('[data-slot="session-confetti"]'),
        ).toBeNull();
    });

    it('renders nothing for a member who reduced animations on the account', () => {
        prefersReducedMotion(false);
        document.documentElement.classList.add('reduce-motion');

        render(<SessionConfetti colors={['moss']} />);

        expect(
            document.querySelector('[data-slot="session-confetti"]'),
        ).toBeNull();
    });
});
