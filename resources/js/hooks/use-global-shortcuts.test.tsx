import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { openKeyboardShortcutsEvent } from '@/lib/shortcuts/events';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';

let component = 'teams/show';
let playsUnknownCard = true;

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ component, props: {} }),
}));

function Probe() {
    const shortcuts = useGlobalShortcuts();

    return (
        <div>
            <output data-testid="state">{`${shortcuts.open}|${shortcuts.context ?? 'none'}`}</output>
            <input aria-label="field" />
            <div data-testid="canvas" className="excalidraw" tabIndex={0} />
            <div
                data-testid="deck"
                data-slot="poker-deck"
                tabIndex={0}
                onKeyDown={(event) => {
                    if (playsUnknownCard) {
                        event.preventDefault();
                    }
                }}
            />
        </div>
    );
}

describe('useGlobalShortcuts', () => {
    it('opens with "?" and with mod+/', () => {
        const { unmount } = render(<Probe />);
        fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
        expect(screen.getByTestId('state').textContent).toBe('true|none');
        unmount();

        render(<Probe />);
        fireEvent.keyDown(document.body, { key: '/', metaKey: true });
        expect(screen.getByTestId('state').textContent).toBe('true|none');
    });

    it('ignores "?" typed in a field but keeps mod+/ there', () => {
        render(<Probe />);

        fireEvent.keyDown(screen.getByLabelText('field'), {
            key: '?',
            shiftKey: true,
        });
        expect(screen.getByTestId('state').textContent).toContain('false');

        fireEvent.keyDown(screen.getByLabelText('field'), {
            key: '/',
            ctrlKey: true,
        });
        expect(screen.getByTestId('state').textContent).toContain('true');
    });

    it('ignores "?" during text composition, on key repeat, inside the whiteboard canvas and on a poker deck that plays its "?" card', () => {
        render(<Probe />);

        fireEvent.keyDown(document.body, {
            key: '?',
            shiftKey: true,
            isComposing: true,
        });
        fireEvent.keyDown(document.body, {
            key: '?',
            shiftKey: true,
            repeat: true,
        });
        fireEvent.keyDown(screen.getByTestId('canvas'), {
            key: '?',
            shiftKey: true,
        });
        fireEvent.keyDown(screen.getByTestId('deck'), {
            key: '?',
            shiftKey: true,
        });

        expect(screen.getByTestId('state').textContent).toContain('false');
    });

    it('opens with "?" on a poker deck that has no "?" card to play', () => {
        playsUnknownCard = false;
        render(<Probe />);

        fireEvent.keyDown(screen.getByTestId('deck'), {
            key: '?',
            shiftKey: true,
        });
        playsUnknownCard = true;

        expect(screen.getByTestId('state').textContent).toContain('true');
    });

    it('opens with "?" on a layout where it needs AltGr or no shift', () => {
        render(<Probe />);

        fireEvent.keyDown(document.body, {
            key: '?',
            altKey: true,
            ctrlKey: true,
        });

        expect(screen.getByTestId('state').textContent).toContain('true');
    });

    it('opens when a button or the palette asks for it', () => {
        render(<Probe />);

        act(() => {
            window.dispatchEvent(new Event(openKeyboardShortcutsEvent));
        });

        expect(screen.getByTestId('state').textContent).toContain('true');
    });

    it('leaves "?" alone while single-key shortcuts are off, and still opens with mod+/', () => {
        window.localStorage.setItem('skrum.single-key-shortcuts', 'false');
        render(<Probe />);
        window.localStorage.removeItem('skrum.single-key-shortcuts');

        fireEvent.keyDown(document.body, { key: '?', shiftKey: true });

        expect(screen.getByTestId('state').textContent).toContain('false');

        fireEvent.keyDown(document.body, { key: '/', metaKey: true });
        setSingleKeyShortcuts(true);

        expect(screen.getByTestId('state').textContent).toContain('true');
    });

    it('gives the section of the session on screen', () => {
        component = 'poker/show';
        render(<Probe />);

        expect(screen.getByTestId('state').textContent).toBe('false|poker');
        component = 'teams/show';
    });
});
