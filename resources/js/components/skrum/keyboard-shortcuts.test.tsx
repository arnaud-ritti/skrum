import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Armchair, Keyboard, Spade } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    KeyboardShortcuts,
    KeyboardShortcutsPanel,
} from '@/components/skrum/keyboard-shortcuts';
import type {
    KeyboardShortcutsProps,
    ShortcutSection,
} from '@/components/skrum/keyboard-shortcuts';
import { renderWithProviders } from '@/test/render';

const sections: ShortcutSection[] = [
    {
        id: 'poker',
        title: 'Poker',
        icon: Spade,
        items: [
            {
                id: 'pick',
                label: 'Pick a card',
                keys: [],
                range: ['0', '9'],
                keywords: ['vote', 'estimate'],
            },
            {
                id: 'reveal',
                label: 'Reveal the cards',
                keys: ['R'],
                facilitatorOnly: true,
            },
            { id: 'revote', label: 'Vote again', keys: ['shift', 'R'] },
        ],
    },
    {
        id: 'retro',
        title: 'Retro',
        icon: Armchair,
        items: [
            { id: 'next', label: 'Next phase', keys: ['mod', 'ArrowRight'] },
        ],
    },
    {
        id: 'general',
        title: 'General',
        icon: Keyboard,
        items: [
            { id: 'palette', label: 'Command palette', keys: ['mod', 'K'] },
        ],
    },
];

function Harness(props: Partial<KeyboardShortcutsProps>) {
    const [query, setQuery] = useState('');

    return (
        <KeyboardShortcuts
            open
            onOpenChange={() => {}}
            sections={sections}
            platform="mac"
            query={query}
            onQueryChange={setQuery}
            {...props}
        />
    );
}

function sectionTitles(): string[] {
    return screen
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-label') ?? '')
        .filter((label) => ['General', 'Retro', 'Poker'].includes(label));
}

describe('KeyboardShortcuts', () => {
    it('puts General first then the current context', () => {
        renderWithProviders(<Harness context="retro" />);

        expect(sectionTitles()).toEqual(['General', 'Retro', 'Poker']);
    });

    it('renders mod as the command key on mac and Ctrl elsewhere', () => {
        const { rerender } = renderWithProviders(<Harness platform="mac" />);

        expect(screen.getByRole('group', { name: 'Command K' })).toBeTruthy();

        rerender(<Harness platform="other" />);

        expect(
            screen.getByRole('group', { name: 'Control K' }).textContent,
        ).toBe('CtrlK');
    });

    it('announces shift combos readably', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByRole('group', { name: 'Shift R' })).toBeTruthy();
    });

    it('marks facilitator shortcuts instead of hiding them', () => {
        renderWithProviders(<Harness />);

        expect(
            screen.getAllByRole('img', { name: 'Facilitator only' }),
        ).toHaveLength(1);
    });

    it('filters by keyword, highlights the match and announces the count', () => {
        renderWithProviders(<Harness query="vote" />);

        expect(screen.getByText('Pick a card')).toBeTruthy();
        expect(screen.queryByText('Reveal the cards')).toBeNull();
        expect(screen.queryByText('Command palette')).toBeNull();
        expect(screen.getByRole('status').textContent).toBe('2 results');
        expect(document.querySelector('mark')?.textContent?.toLowerCase()).toBe(
            'vote',
        );
    });

    it('matches without regard to case', () => {
        renderWithProviders(<Harness query="COMMAND" />);

        expect(screen.getByText('Command')).toBeTruthy();
        expect(screen.getByRole('status').textContent).toBe('1 result');
    });

    it('shows the empty state and opens the palette from it', () => {
        const onOpenCommandPalette = vi.fn();
        renderWithProviders(
            <Harness
                query="export"
                onOpenCommandPalette={onOpenCommandPalette}
            />,
        );

        expect(screen.getByText('No shortcut for “export”')).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: /Open the command palette/ }),
        );

        expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
    });

    it('hides the palette button of the empty state without a callback', () => {
        renderWithProviders(<Harness query="export" />);

        expect(
            screen.queryByRole('button', { name: /Open the command palette/ }),
        ).toBeNull();
    });

    it('switches platform through the tabs and reports it', () => {
        const onPlatformChange = vi.fn();
        renderWithProviders(<Harness onPlatformChange={onPlatformChange} />);

        const tab = screen.getByRole('tab', { name: 'Windows · Linux' });
        fireEvent.mouseDown(tab);
        fireEvent.click(tab);

        expect(onPlatformChange).toHaveBeenCalledWith('other');
    });

    it('focuses the search field on open and with the slash key', () => {
        renderWithProviders(<Harness />);

        const search = screen.getByRole('searchbox');
        expect(document.activeElement).toBe(search);

        (document.activeElement as HTMLElement).blur();
        fireEvent.keyDown(document.body, { key: '/' });

        expect(document.activeElement).toBe(search);
    });

    it('closes with Escape', () => {
        const onOpenChange = vi.fn();
        renderWithProviders(<Harness onOpenChange={onOpenChange} />);

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('returns the focus to the element that had it when it closes', async () => {
        function Opener() {
            const [open, setOpen] = useState(false);

            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>
                        Open
                    </button>
                    <KeyboardShortcuts
                        open={open}
                        onOpenChange={setOpen}
                        sections={sections}
                        platform="mac"
                    />
                </>
            );
        }

        renderWithProviders(<Opener />);

        const opener = screen.getByRole('button', { name: 'Open' });

        opener.focus();
        fireEvent.click(opener);

        expect(document.activeElement).toBe(screen.getByRole('searchbox'));

        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(document.activeElement).toBe(opener);
    });

    it('stacks header, search, body and footer in a column', () => {
        renderWithProviders(<Harness />);

        const dialog = screen.getByRole('dialog');
        const blocks = Array.from(dialog.children).map(
            (child) =>
                child.getAttribute('data-slot') ?? child.tagName.toLowerCase(),
        );

        expect(dialog.className).toContain('flex-col');
        expect(blocks.indexOf('header')).toBeLessThan(
            blocks.indexOf('keyboard-shortcuts-body'),
        );
        expect(blocks.indexOf('keyboard-shortcuts-body')).toBeLessThan(
            blocks.indexOf('footer'),
        );
    });

    it('labels the dialog with its title', () => {
        renderWithProviders(<Harness />);

        const dialog = screen.getByRole('dialog', {
            name: 'Keyboard shortcuts',
        });

        expect(within(dialog).getByRole('searchbox')).toBeTruthy();
    });

    it('says that single-key shortcuts are off, and names the key that still opens it', () => {
        renderWithProviders(<Harness singleKeyDisabled />);

        const status = screen
            .getAllByRole('status')
            .find((node) =>
                node.textContent?.startsWith('Single-key shortcuts are off.'),
            );

        expect(status?.textContent).toBe(
            'Single-key shortcuts are off. Shortcuts with ⌘ or Ctrl still work.',
        );
        expect(
            document.querySelector('[data-slot="keyboard-shortcuts"] footer')
                ?.textContent,
        ).toContain('⌘/at any time');
    });

    it('keeps the result count live region mounted before the first search', () => {
        const { rerender } = renderWithProviders(<Harness />);
        const status = screen.getByRole('status');

        expect(status.textContent).toBe('');

        rerender(<Harness query="vote" />);

        expect(screen.getByRole('status')).toBe(status);
        expect(status.textContent).toBe('2 results');
    });

    it('names the scrolling list and hides the / hint while single keys are off', () => {
        const { rerender } = renderWithProviders(<Harness />);
        const searchHint = () =>
            screen.getByRole('searchbox').parentElement?.querySelector('kbd')
                ?.textContent;

        expect(
            screen.getByRole('group', { name: 'Keyboard shortcuts' }),
        ).toBeTruthy();
        expect(searchHint()).toBe('/');

        rerender(<Harness singleKeyDisabled />);

        expect(searchHint()).toBeUndefined();
    });

    it('has no such line while they are on, and renders the extra control at the end of the footer', () => {
        renderWithProviders(
            <Harness footerExtra={<button type="button">Extra</button>} />,
        );

        expect(
            document.querySelector(
                '[data-slot="keyboard-shortcuts-single-key-off"]',
            ),
        ).toBeNull();

        const footer = document.querySelector(
            '[data-slot="keyboard-shortcuts"] footer',
        );

        expect(footer?.lastElementChild?.textContent).toBe('Extra');
        expect(footer?.textContent).toContain('?at any time');
    });

    it('renders nothing when closed', () => {
        renderWithProviders(<Harness open={false} />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});

describe('KeyboardShortcutsPanel', () => {
    it('shows the reference inline, without a dialog, and filters on its own', () => {
        renderWithProviders(
            <KeyboardShortcutsPanel sections={sections} platform="mac" />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();

        const panel = screen.getByRole('region', {
            name: 'Keyboard shortcuts',
        });
        const before = within(panel).getAllByRole('listitem').length;

        fireEvent.change(
            within(panel).getByRole('searchbox', { name: 'Search shortcuts' }),
            { target: { value: 'zzzz' } },
        );

        expect(before).toBeGreaterThan(0);
        expect(within(panel).queryAllByRole('listitem')).toHaveLength(0);
        expect(within(panel).getByText('No shortcut for “zzzz”')).toBeTruthy();
    });
});
