import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { cn } from '@/lib/utils';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import { CanvasSelection } from './canvas-selection';
import { CanvasTools } from './canvas-tools';
import { CanvasView } from './canvas-view';

type Props = {
    /** Null until the canvas is ready. */
    api: ExcalidrawImperativeAPI | null;
    /** Null while the canvas is loading: no bar is shown. */
    snapshot: CanvasSnapshot | null;
    editing: boolean;
    isPhone: boolean;
    isFacilitator: boolean;
    /** The library's canvas and what sits over it. */
    children: ReactNode;
};

/**
 * The canvas wrapper and the board's own bars over it (ScreenWhiteboard): the
 * library's chrome is hidden by `skrum-whiteboard--own-chrome`, and "Styles"
 * shows its property panel again through `skrum-whiteboard--styles`.
 */
export function BoardChrome({
    api,
    snapshot,
    editing,
    isPhone,
    isFacilitator,
    children,
}: Props) {
    const canvas = useRef<HTMLDivElement | null>(null);
    const [stylesShown, setStylesShown] = useState(false);
    const ready = api !== null && snapshot !== null;

    return (
        <div
            ref={canvas}
            className={cn(
                'whiteboard-canvas skrum-whiteboard--fallback-colors skrum-whiteboard--own-chrome relative min-h-0 flex-1',
                stylesShown && 'skrum-whiteboard--styles',
            )}
            data-facilitator={isFacilitator}
        >
            {children}
            {ready && (
                <CanvasView
                    api={api}
                    snapshot={snapshot}
                    canvas={canvas}
                    editing={editing}
                />
            )}
            {ready && editing && !isPhone && (
                <CanvasTools api={api} snapshot={snapshot} canvas={canvas} />
            )}
            {ready && (
                <CanvasSelection
                    api={api}
                    snapshot={snapshot}
                    canvas={canvas}
                    isFacilitator={isFacilitator}
                    editing={editing}
                    stylesShown={stylesShown}
                    onStylesChange={setStylesShown}
                />
            )}
        </div>
    );
}
