import { Scan } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { WhiteboardToolButton } from '@/components/skrum/whiteboard-toolbar';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import { CanvasSelection } from './canvas-selection';
import { CanvasTools } from './canvas-tools';
import { CanvasView, fitToScreen } from './canvas-view';
import { PhoneToolbar } from './phone-toolbar';
import { ReadModeLayer } from './read-mode-toggle';
import { useCanvasKeyGuard } from './use-canvas-key-guard';

type Props = {
    /** Null until the canvas is ready. */
    api: ExcalidrawImperativeAPI | null;
    /** Null while the canvas is loading: no bar is shown. */
    snapshot: CanvasSnapshot | null;
    editing: boolean;
    isPhone: boolean;
    isFacilitator: boolean;
    /** The phone's read mode, for a viewer who may switch it (`canSwitchReadMode`). */
    readMode?: { reading: boolean; onChange: (reading: boolean) => void };
    /** The library's canvas and what sits over it. */
    children: ReactNode;
};

/**
 * The canvas wrapper and the board's own bars over it (ScreenWhiteboard): the
 * library's chrome is hidden by `skrum-whiteboard--own-chrome`, and "Styles"
 * shows its property panel again through `skrum-whiteboard--styles`. On a
 * phone (MobileRituals) the read mode dock holds "Fit to screen" while
 * reading and the compact tool bar while editing; no zoom bar, history or
 * minimap (pinch zoom).
 */
export function BoardChrome({
    api,
    snapshot,
    editing,
    isPhone,
    isFacilitator,
    readMode,
    children,
}: Props) {
    const { t } = useTrans();
    const canvas = useRef<HTMLDivElement | null>(null);
    const [stylesShown, setStylesShown] = useState(false);
    const ready = api !== null && snapshot !== null;

    useCanvasKeyGuard(canvas);

    /** The phone's panel of shape actions opens only on the library's own "shape" menu. */
    const changeStyles = useCallback(
        (shown: boolean): void => {
            setStylesShown(shown);

            if (!isPhone || api === null) {
                return;
            }

            api.updateScene({ appState: { openMenu: shown ? 'shape' : null } });
        },
        [api, isPhone],
    );

    const dockActions = (): ReactNode => {
        if (api === null || readMode === undefined) {
            return null;
        }

        if (readMode.reading) {
            return (
                <div className="pointer-events-auto inline-flex rounded-xl border border-border bg-popover p-1 shadow-raised">
                    <WhiteboardToolButton
                        item={{
                            id: 'fit',
                            label: t('Fit to screen'),
                            icon: Scan,
                            onPress: () => fitToScreen(api),
                        }}
                        size="touch"
                        tooltipSide="top"
                        tabIndex={0}
                    />
                </div>
            );
        }

        if (!ready) {
            return null;
        }

        return <PhoneToolbar api={api} snapshot={snapshot} canvas={canvas} />;
    };

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
            {ready && !isPhone && (
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
                    onStylesChange={changeStyles}
                />
            )}
            {api !== null && readMode !== undefined && (
                <ReadModeLayer
                    reading={readMode.reading}
                    onChange={readMode.onChange}
                    dockActions={dockActions()}
                />
            )}
        </div>
    );
}
