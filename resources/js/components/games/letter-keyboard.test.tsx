import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LetterKeyboard } from './letter-keyboard';

function rowsOf(group: HTMLElement): string[] {
    return [...group.querySelectorAll('[data-slot="keyboard-row"]')].map(
        (row) => row.textContent ?? '',
    );
}

describe('LetterKeyboard', () => {
    it.each([
        ['azerty', ['azertyuiop', 'qsdfghjklm', 'wxcvbn']],
        ['qwertz', ['qwertzuiop', 'asdfghjkl', 'yxcvbnm']],
        ['qwerty', ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']],
    ] as const)('lays the 26 keys out as %s', (layout, rows) => {
        render(
            <LetterKeyboard
                layout={layout}
                picked={[]}
                hits={[]}
                disabled={false}
                onPick={vi.fn()}
            />,
        );

        const group = screen.getByRole('group', { name: 'Letters' });

        expect(within(group).getAllByRole('button')).toHaveLength(26);
        expect(rowsOf(group)).toEqual(rows);
    });

    it('picks a free letter and locks a picked one, a hit apart from a miss', () => {
        const onPick = vi.fn();

        render(
            <LetterKeyboard
                layout="qwerty"
                picked={['q', 'x']}
                hits={['q']}
                disabled={false}
                onPick={onPick}
            />,
        );

        const hit = screen.getByRole('button', { name: 'q' });
        const miss = screen.getByRole('button', { name: 'x' });
        const free = screen.getByRole('button', { name: 'u' });

        expect(hit.getAttribute('data-state')).toBe('hit');
        expect(hit.getAttribute('aria-pressed')).toBe('true');
        expect(hit).toHaveProperty('disabled', true);
        expect(miss.getAttribute('data-state')).toBe('miss');
        expect(miss).toHaveProperty('disabled', true);
        expect(free.getAttribute('data-state')).toBe('free');
        expect(free.getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(free);
        fireEvent.click(miss);

        expect(onPick).toHaveBeenCalledTimes(1);
        expect(onPick).toHaveBeenCalledWith('u');
    });

    it('locks every key while a pick is pending', () => {
        render(
            <LetterKeyboard
                layout="qwerty"
                picked={[]}
                hits={[]}
                disabled
                onPick={vi.fn()}
            />,
        );

        expect(
            screen
                .getAllByRole('button')
                .every((key) => (key as HTMLButtonElement).disabled),
        ).toBe(true);
    });
});
