import { useEffect, useRef, useState } from 'react';

/** Rounded width of an element in px, `defaultWidth` until it is measured, never under `minWidth`. */
export function useElementWidth(defaultWidth: number, minWidth: number) {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(defaultWidth);

    useEffect(() => {
        const element = ref.current;

        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const measured = entries[0]?.contentRect.width ?? 0;

            if (measured > 0) {
                setWidth(Math.round(measured));
            }
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, width: Math.max(width, minWidth) };
}
