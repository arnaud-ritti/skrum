import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { matchesShortcut, useShortcut } from '@/hooks/use-shortcut';
import type { UseShortcutOptions } from '@/hooks/use-shortcut';

function Probe({
    combo,
    handler,
    options,
}: {
    combo: string;
    handler: () => void;
    options?: UseShortcutOptions;
}) {
    useShortcut(combo, handler, options);

    return (
        <div>
            <input aria-label="field" />
            <div data-testid="editable" contentEditable="true" />
        </div>
    );
}

describe('useShortcut', () => {
    it('fires for a plain key on the document', () => {
        const handler = vi.fn();
        render(<Probe combo="n" handler={handler} />);

        fireEvent.keyDown(document.body, { key: 'n' });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('ignores events coming from inputs', () => {
        const handler = vi.fn();
        const { getByLabelText } = render(
            <Probe combo="n" handler={handler} />,
        );

        fireEvent.keyDown(getByLabelText('field'), { key: 'n' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores events coming from contenteditable elements', () => {
        const handler = vi.fn();
        const { getByTestId } = render(<Probe combo="n" handler={handler} />);

        fireEvent.keyDown(getByTestId('editable'), { key: 'n' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('fires from form tags when enableOnFormTags is set', () => {
        const handler = vi.fn();
        const { getByLabelText } = render(
            <Probe
                combo="mod+/"
                handler={handler}
                options={{ enableOnFormTags: true }}
            />,
        );

        fireEvent.keyDown(getByLabelText('field'), { key: '/', ctrlKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('treats mod as meta or ctrl', () => {
        const handler = vi.fn();
        render(<Probe combo="mod+k" handler={handler} />);

        fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
        fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
        fireEvent.keyDown(document.body, { key: 'k' });

        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('does nothing while disabled', () => {
        const handler = vi.fn();
        render(
            <Probe combo="n" handler={handler} options={{ enabled: false }} />,
        );

        fireEvent.keyDown(document.body, { key: 'n' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('stops listening after unmount', () => {
        const handler = vi.fn();
        const { unmount } = render(<Probe combo="n" handler={handler} />);

        unmount();
        fireEvent.keyDown(document.body, { key: 'n' });

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('matchesShortcut', () => {
    const press = (init: KeyboardEventInit) =>
        new KeyboardEvent('keydown', init);

    it('requires shift for letters when the combo names it', () => {
        expect(
            matchesShortcut(press({ key: 'R', shiftKey: true }), 'shift+r'),
        ).toBe(true);
        expect(matchesShortcut(press({ key: 'r' }), 'shift+r')).toBe(false);
        expect(matchesShortcut(press({ key: 'R', shiftKey: true }), 'r')).toBe(
            false,
        );
    });

    it('accepts ? although it is typed with shift', () => {
        expect(matchesShortcut(press({ key: '?', shiftKey: true }), '?')).toBe(
            true,
        );
    });

    it('rejects an extra modifier', () => {
        expect(matchesShortcut(press({ key: 'k', metaKey: true }), 'k')).toBe(
            false,
        );
        expect(matchesShortcut(press({ key: 'k', altKey: true }), 'k')).toBe(
            false,
        );
    });

    it('supports named keys and the plus key', () => {
        expect(
            matchesShortcut(
                press({ key: 'ArrowRight', ctrlKey: true }),
                'mod+ArrowRight',
            ),
        ).toBe(true);
        expect(
            matchesShortcut(press({ key: '+', ctrlKey: true }), 'mod++'),
        ).toBe(true);
        expect(matchesShortcut(press({ key: ' ' }), 'space')).toBe(true);
    });
});
