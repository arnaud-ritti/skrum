import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/** How far under the top of the viewport a section starts to count as the one in view, in rem. */
const ReadingLineRem = 7;

const ScrollEdgeTolerance = 2;

function sectionOfHash(ids: readonly string[]): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const hash = window.location.hash.slice(1);

    return ids.find((id) => id === hash);
}

function readingLine(): number {
    const rootFontSize = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
    );

    return ReadingLineRem * (Number.isNaN(rootFontSize) ? 16 : rootFontSize);
}

function reachedTheEnd(target: EventTarget | null): boolean {
    const scroller =
        target instanceof HTMLElement
            ? target
            : (document.scrollingElement ?? document.documentElement);

    if (scroller.scrollHeight <= scroller.clientHeight) {
        return false;
    }

    return (
        scroller.scrollTop + scroller.clientHeight >=
        scroller.scrollHeight - ScrollEdgeTolerance
    );
}

/**
 * Which section of a long page is in view: the last one whose top passed
 * the reading line, the last of all once the page is scrolled to its end.
 * A section chosen by its link stays the current one until the page has
 * reached it or the reader scrolls by themselves, and the address keeps
 * its anchor.
 *
 * @param ids the anchors of the sections, in the order of the page
 * @param address changes when a visit leads to another anchor of the same page
 */
export function useVisibleSection(
    ids: readonly string[],
    address?: string,
): { current: string; select: (id: string) => void } {
    const key = ids.join('|');
    const [current, setCurrent] = useState<string>(
        () => sectionOfHash(ids) ?? ids[0],
    );
    const chosen = useRef<string | null>(null);

    useEffect(() => {
        const anchors = key.split('|');
        const id = sectionOfHash(anchors);

        if (id === undefined) {
            chosen.current = null;

            return;
        }

        chosen.current = id;
        setCurrent(id);
        document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
    }, [key, address]);

    useEffect(() => {
        const anchors = key.split('|');
        let frame = 0;
        let lastTarget: EventTarget | null = null;

        const measure = (): void => {
            frame = 0;

            if (chosen.current !== null) {
                return;
            }

            if (reachedTheEnd(lastTarget)) {
                setCurrent(anchors[anchors.length - 1]);

                return;
            }

            const line = readingLine();
            let visible = anchors[0];

            for (const id of anchors) {
                const section = document.getElementById(id);

                if (
                    section !== null &&
                    section.getBoundingClientRect().top <= line
                ) {
                    visible = id;
                }
            }

            setCurrent(visible);
        };

        const onScroll = (event: Event): void => {
            lastTarget = event.target;

            if (frame === 0) {
                frame = window.requestAnimationFrame(measure);
            }
        };

        const release = (): void => {
            chosen.current = null;
        };

        /** A scroll that ends in another scroller, the list of the navigation for one, is not the arrival. */
        const releaseOnArrival = (event: Event): void => {
            const section =
                chosen.current === null
                    ? null
                    : document.getElementById(chosen.current);

            if (
                event.target instanceof Element &&
                !event.target.contains(section)
            ) {
                return;
            }

            release();
        };

        document.addEventListener('scroll', onScroll, {
            capture: true,
            passive: true,
        });
        document.addEventListener('scrollend', releaseOnArrival, {
            capture: true,
            passive: true,
        });
        window.addEventListener('pointerdown', release, { passive: true });
        window.addEventListener('wheel', release, { passive: true });
        window.addEventListener('touchmove', release, { passive: true });
        window.addEventListener('keydown', release);

        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('scroll', onScroll, { capture: true });
            document.removeEventListener('scrollend', releaseOnArrival, {
                capture: true,
            });
            window.removeEventListener('pointerdown', release);
            window.removeEventListener('wheel', release);
            window.removeEventListener('touchmove', release);
            window.removeEventListener('keydown', release);
        };
    }, [key]);

    const select = useCallback((id: string): void => {
        const section = document.getElementById(id);

        chosen.current = id;
        setCurrent(id);
        window.history.replaceState(window.history.state, '', `#${id}`);

        if (section === null) {
            return;
        }

        section.scrollIntoView?.({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start',
        });
        section.focus({ preventScroll: true });
    }, []);

    return { current, select };
}
