import { useEffect, useRef, useState } from 'react';

const RootFontSize = 16;

/** Height of an element in rem, zero while it is not on screen: what a bar docked above it must clear. */
export function useHeightInRem<T extends HTMLElement = HTMLDivElement>(): [
    (node: T | null) => void,
    number,
] {
    const [node, setNode] = useState<T | null>(null);
    const [height, setHeight] = useState(0);
    const observer = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        if (node === null) {
            return;
        }

        const measure = () => {
            const root = parseFloat(
                getComputedStyle(document.documentElement).fontSize,
            );

            setHeight(
                node.getBoundingClientRect().height / (root || RootFontSize),
            );
        };

        measure();
        observer.current = new ResizeObserver(measure);
        observer.current.observe(node);

        return () => observer.current?.disconnect();
    }, [node]);

    return [setNode, node === null ? 0 : height];
}
