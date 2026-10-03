import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisibleSection } from './use-visible-section';

const ids = ['profile', 'security', 'api-tokens'];

const tops: Record<string, number> = {};
const scrolled: { id: string; options: unknown }[] = [];

function Page({ address }: { address?: string }) {
    const { current, select } = useVisibleSection(ids, address);

    return (
        <div>
            <output>{current}</output>
            {ids.map((id) => (
                <button key={id} type="button" onClick={() => select(id)}>
                    go to {id}
                </button>
            ))}
            {ids.map((id) => (
                <section key={id} id={id} tabIndex={-1} />
            ))}
        </div>
    );
}

function scrollTo(positions: Record<string, number>): void {
    Object.assign(tops, positions);

    act(() => {
        fireEvent.scroll(document);
    });
}

function current(): string | null {
    return screen.getByRole('status').textContent;
}

function reduceMotion(reduce: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduce });
}

beforeEach(() => {
    scrolled.length = 0;
    Object.assign(tops, { profile: 0, security: 900, 'api-tokens': 1800 });
    window.history.replaceState(null, '', '/settings');
    reduceMotion(false);

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);

        return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
        function (this: HTMLElement) {
            return { top: tops[this.id] ?? 0 } as DOMRect;
        },
    );
    HTMLElement.prototype.scrollIntoView = function (
        this: HTMLElement,
        options?: unknown,
    ) {
        scrolled.push({ id: this.id, options });
    };
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useVisibleSection', () => {
    it('starts on the first section and scrolls nowhere without an anchor', () => {
        render(<Page />);

        expect(current()).toBe('profile');
        expect(scrolled).toEqual([]);
    });

    it('marks the last section whose top passed the reading line', () => {
        render(<Page />);

        scrollTo({ profile: -800, security: 100, 'api-tokens': 1000 });
        expect(current()).toBe('security');

        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });
        expect(current()).toBe('api-tokens');

        scrollTo({ profile: 0, security: 900, 'api-tokens': 1800 });
        expect(current()).toBe('profile');
    });

    it('marks the last section once the page is scrolled to its end, even when its top cannot reach the line', () => {
        render(<Page />);

        const scroller = document.documentElement;

        vi.spyOn(scroller, 'scrollHeight', 'get').mockReturnValue(2000);
        vi.spyOn(scroller, 'clientHeight', 'get').mockReturnValue(800);
        scroller.scrollTop = 1200;

        scrollTo({ profile: -1200, security: -300, 'api-tokens': 600 });

        expect(current()).toBe('api-tokens');

        scroller.scrollTop = 0;
    });

    it('opens on the section the address names and scrolls to it', () => {
        window.history.replaceState(null, '', '/settings#security');

        render(<Page />);

        expect(current()).toBe('security');
        expect(scrolled).toEqual([
            { id: 'security', options: { block: 'start' } },
        ]);
    });

    it('follows a visit that leads to another anchor of the page', () => {
        const { rerender } = render(<Page address="/settings" />);

        window.history.replaceState(null, '', '/settings#api-tokens');
        rerender(<Page address="/settings#api-tokens" />);

        expect(current()).toBe('api-tokens');
        expect(scrolled.map((entry) => entry.id)).toEqual(['api-tokens']);
    });

    it('ignores an anchor that names no section', () => {
        window.history.replaceState(null, '', '/settings#elsewhere');

        render(<Page />);

        expect(current()).toBe('profile');
        expect(scrolled).toEqual([]);
    });

    it('scrolls smoothly to a chosen section, focuses it and writes its anchor in the address', () => {
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));

        expect(current()).toBe('security');
        expect(scrolled).toEqual([
            { id: 'security', options: { behavior: 'smooth', block: 'start' } },
        ]);
        expect(window.location.hash).toBe('#security');
        expect(document.activeElement?.id).toBe('security');
    });

    it('jumps without motion when the reader asked for reduced motion', () => {
        reduceMotion(true);
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));

        expect(scrolled).toEqual([
            { id: 'security', options: { behavior: 'auto', block: 'start' } },
        ]);
    });

    it('jumps without motion when the account asks for fewer animations', () => {
        document.documentElement.classList.add('reduce-motion');
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));

        document.documentElement.classList.remove('reduce-motion');

        expect(scrolled).toEqual([
            { id: 'security', options: { behavior: 'auto', block: 'start' } },
        ]);
    });

    it('keeps the chosen section current while the page scrolls to it, until the reader scrolls', () => {
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));
        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });

        expect(current()).toBe('security');

        fireEvent.wheel(window);
        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });

        expect(current()).toBe('api-tokens');
    });

    it('lets the mark follow the page again after a visit that comes back without an anchor', () => {
        const { rerender } = render(<Page address="/settings#security" />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));
        window.history.replaceState(null, '', '/settings');
        rerender(<Page address="/settings" />);
        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });

        expect(current()).toBe('api-tokens');
    });

    it('lets the mark follow the page again once the reader presses a pointer, on a scrollbar for instance', () => {
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));
        fireEvent.pointerDown(window);
        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });

        expect(current()).toBe('api-tokens');
    });

    it('lets the mark follow the page again once the scroll to the chosen section has ended', () => {
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));
        fireEvent(document, new Event('scrollend'));
        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });

        expect(current()).toBe('api-tokens');
    });

    it('keeps the chosen section when a scroll ends elsewhere than around it', () => {
        render(<Page />);

        fireEvent.click(screen.getByRole('button', { name: 'go to security' }));
        fireEvent(
            screen.getByRole('button', { name: 'go to profile' }),
            new Event('scrollend'),
        );
        scrollTo({ profile: -1700, security: -800, 'api-tokens': 110 });

        expect(current()).toBe('security');
    });
});
