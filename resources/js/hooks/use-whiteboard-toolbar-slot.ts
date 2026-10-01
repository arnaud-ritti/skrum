import { useEffect, useState, type RefObject } from 'react';
import { ToolbarDom } from '@/lib/whiteboard/excalidraw';

function createHost(): HTMLElement | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const host = document.createElement('div');

    // The row lays out its children; the host must not be one of them.
    host.style.display = 'contents';

    return host;
}

/**
 * A place for one more tool in the canvas shapes toolbar, right before the
 * eraser. The library has no way to add a tool, so an element of ours is put
 * among its buttons and put back whenever the library redraws the row.
 * Returns null while the toolbar is not there (view mode, a layout or a
 * version without it), so the caller can show the tool elsewhere.
 */
export function useWhiteboardToolbarSlot(
    canvas: RefObject<HTMLElement | null>,
    ready: boolean,
): HTMLElement | null {
    const [host] = useState(createHost);
    const [attached, setAttached] = useState(false);

    useEffect(() => {
        const container = canvas.current;

        if (!ready || !container || !host) {
            return;
        }

        const attach = () => {
            const eraser = container
                .querySelector(ToolbarDom.eraser)
                ?.closest(ToolbarDom.tool);
            const row = eraser?.parentElement;

            if (!eraser || !row) {
                host.remove();
                setAttached(false);

                return;
            }

            if (host.nextElementSibling !== eraser) {
                row.insertBefore(host, eraser);
            }

            setAttached(true);
        };

        attach();

        const observer = new MutationObserver(attach);

        observer.observe(container, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
            host.remove();
            setAttached(false);
        };
    }, [canvas, ready, host]);

    return attached ? host : null;
}
