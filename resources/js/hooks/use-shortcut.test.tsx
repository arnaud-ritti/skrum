import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
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

function ScopedProbe({
    combo,
    handler,
    enabled,
}: {
    combo: string | string[];
    handler: (event: KeyboardEvent) => void;
    enabled: boolean;
}) {
    const scope = useRef<HTMLDivElement>(null);

    useShortcut(combo, handler, { enabled, scope });

    return <div ref={scope} data-testid="scope" />;
}

function appendOverlay(role: string): {
    overlay: HTMLElement;
    button: HTMLElement;
} {
    const overlay = document.createElement('div');
    const button = document.createElement('button');

    overlay.setAttribute('role', role);
    overlay.append(button);
    document.body.append(overlay);

    return { overlay, button };
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

    it('ignores events coming from role textbox and plaintext-only editors', () => {
        const handler = vi.fn();
        const { container } = render(<Probe combo="n" handler={handler} />);
        const textbox = document.createElement('div');
        const plain = document.createElement('div');

        textbox.setAttribute('role', 'textbox');
        plain.setAttribute('contenteditable', 'plaintext-only');
        container.append(textbox, plain);

        fireEvent.keyDown(textbox, { key: 'n' });
        fireEvent.keyDown(plain, { key: 'n' });

        expect(handler).not.toHaveBeenCalled();
    });

    it.each(['dialog', 'alertdialog', 'menu', 'listbox'])(
        'ignores a key pressed inside a %s opened after the shortcut',
        async (role) => {
            const handler = vi.fn();
            const { container } = render(<Probe combo="r" handler={handler} />);

            await Promise.resolve();

            const overlay = document.createElement('div');
            const button = document.createElement('button');

            overlay.setAttribute('role', role);
            overlay.append(button);
            container.append(overlay);

            fireEvent.keyDown(button, { key: 'r' });

            expect(handler).not.toHaveBeenCalled();

            overlay.remove();
            fireEvent.keyDown(document.body, { key: 'r' });

            expect(handler).toHaveBeenCalledTimes(1);
        },
    );

    it('ignores a key pressed on the page while focus is inside a modal overlay', async () => {
        const handler = vi.fn();
        const { container } = render(<Probe combo="r" handler={handler} />);

        await Promise.resolve();

        const overlay = document.createElement('div');
        const button = document.createElement('button');

        overlay.setAttribute('aria-modal', 'true');
        overlay.append(button);
        container.append(overlay);
        button.focus();

        fireEvent.keyDown(document.body, { key: 'r' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('keeps a shortcut registered by an overlay that was already open', async () => {
        const overlay = document.createElement('div');
        const button = document.createElement('button');

        overlay.setAttribute('role', 'dialog');
        overlay.append(button);
        document.body.append(overlay);

        const handler = vi.fn();
        render(<Probe combo="/" handler={handler} />);

        await Promise.resolve();
        fireEvent.keyDown(button, { key: '/' });
        overlay.remove();

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('fires inside overlays when enableInOverlays is set', async () => {
        const handler = vi.fn();
        const { container } = render(
            <Probe
                combo="r"
                handler={handler}
                options={{ enableInOverlays: true }}
            />,
        );

        await Promise.resolve();

        const overlay = document.createElement('div');

        overlay.setAttribute('role', 'dialog');
        container.append(overlay);
        fireEvent.keyDown(overlay, { key: 'r' });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('ignores a dialog that was open before a scoped shortcut became enabled', async () => {
        const handler = vi.fn();
        const { rerender } = render(
            <ScopedProbe combo="r" handler={handler} enabled={false} />,
        );
        const { overlay, button } = appendOverlay('dialog');

        rerender(<ScopedProbe combo="r" handler={handler} enabled />);
        await Promise.resolve();

        fireEvent.keyDown(button, { key: 'r' });

        expect(handler).not.toHaveBeenCalled();

        overlay.remove();
        fireEvent.keyDown(document.body, { key: 'r' });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('keeps a scoped shortcut alive inside the overlay that contains its scope', () => {
        const handler = vi.fn();
        const overlay = document.createElement('div');

        overlay.setAttribute('role', 'dialog');
        document.body.append(overlay);

        const { getByTestId } = render(
            <ScopedProbe combo="/" handler={handler} enabled />,
            { container: overlay },
        );
        const nested = appendOverlay('menu');

        fireEvent.keyDown(getByTestId('scope'), { key: '/' });
        fireEvent.keyDown(nested.button, { key: '/' });
        nested.overlay.remove();
        overlay.remove();

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('accepts several combos and ignores an event already handled', () => {
        const handler = vi.fn();

        render(<ScopedProbe combo={['1', '2']} handler={handler} enabled />);

        fireEvent.keyDown(document.body, { key: '2' });
        fireEvent.keyDown(document.body, { key: '3' });

        const handled = new KeyboardEvent('keydown', {
            key: '1',
            bubbles: true,
            cancelable: true,
        });

        handled.preventDefault();
        document.body.dispatchEvent(handled);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].key).toBe('2');
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

    it('accepts a sign typed with AltGr, reported as ctrl and alt together', () => {
        const altGraph = { ctrlKey: true, altKey: true };

        expect(matchesShortcut(press({ key: '?', ...altGraph }), '?')).toBe(
            true,
        );
        expect(matchesShortcut(press({ key: 'k', ...altGraph }), 'k')).toBe(
            false,
        );
        expect(matchesShortcut(press({ key: '1', ...altGraph }), '1')).toBe(
            false,
        );
        expect(matchesShortcut(press({ key: '/', ...altGraph }), 'mod+/')).toBe(
            false,
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
