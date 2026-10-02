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

        const hit = screen.getByRole('button', { name: 'q, in the word' });
        const miss = screen.getByRole('button', {
            name: 'x, not in the word',
        });
        const free = screen.getByRole('button', { name: 'u' });

        expect(hit.getAttribute('data-state')).toBe('hit');
        expect(hit.getAttribute('aria-pressed')).toBe('true');
        expect(hit.getAttribute('aria-disabled')).toBe('true');
        expect(miss.getAttribute('data-state')).toBe('miss');
        expect(miss.getAttribute('aria-disabled')).toBe('true');
        expect(free.getAttribute('data-state')).toBe('free');
        expect(free.getAttribute('aria-pressed')).toBe('false');
        expect(free.getAttribute('aria-disabled')).toBe('false');

        fireEvent.click(free);
        fireEvent.click(miss);

        expect(onPick).toHaveBeenCalledTimes(1);
        expect(onPick).toHaveBeenCalledWith('u');
    });

    it('keeps the focus on a key once it is picked', () => {
        const { rerender } = render(
            <LetterKeyboard
                layout="qwerty"
                picked={[]}
                hits={[]}
                disabled={false}
                onPick={vi.fn()}
            />,
        );

        const key = screen.getByRole('button', { name: 'q' });

        key.focus();
        rerender(
            <LetterKeyboard
                layout="qwerty"
                picked={['q']}
                hits={['q']}
                disabled
                onPick={vi.fn()}
            />,
        );

        expect(key).toHaveProperty('disabled', false);
        expect(document.activeElement).toBe(key);
    });

    it('locks every key while a pick is pending', () => {
        const onPick = vi.fn();

        render(
            <LetterKeyboard
                layout="qwerty"
                picked={[]}
                hits={[]}
                disabled
                onPick={onPick}
            />,
        );

        const keys = screen.getAllByRole('button');

        expect(
            keys.every((key) => key.getAttribute('aria-disabled') === 'true'),
        ).toBe(true);

        fireEvent.click(keys[0]);

        expect(onPick).not.toHaveBeenCalled();
    });
});
