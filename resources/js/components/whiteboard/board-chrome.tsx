import { Scan } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { WhiteboardToolButton } from '@/components/skrum/whiteboard-toolbar';
import { useCanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { CaptureUpdateAction } from '@/lib/whiteboard/excalidraw';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import {
    CANVAS_LIGHT,
    opaqueBackground,
    seeThroughBackground,
} from '@/lib/whiteboard/palette';
import {
    DesktopBarsBand,
    FacilitationBand,
    PhoneDockBand,
} from '@/lib/whiteboard/selection';
import { CanvasSelection } from './canvas-selection';
import { CanvasTools } from './canvas-tools';
import { CanvasView, fitToScreen } from './canvas-view';
import { PhoneToolbar } from './phone-toolbar';
import { ReadModeLayer } from './read-mode-toggle';
import { useCanvasKeyGuard } from './use-canvas-key-guard';

type ExportDialog = 'imageExport' | 'jsonExport';

/** World pixels between two dots: the library's grid size, 1.25rem in ScreenWhiteboard. */
const DotSpacing = 20;

/** Screen pixels under which the dots would turn into a grey wash. */
const MinDotSpacing = 8;

function isExportDialog(name: string | undefined): name is ExportDialog {
    return name === 'imageExport' || name === 'jsonExport';
}

/** Opens one of the library's export dialogs on the opaque paper: a dialog keeps the background it opened with. */
export function openExportDialog(
    api: ExcalidrawImperativeAPI,
    name: ExportDialog,
): void {
    api.updateScene({
        appState: {
            openDialog: { name },
            viewBackgroundColor: opaqueBackground(
                api.getAppState().viewBackgroundColor,
            ),
        } as never,
        captureUpdate: CaptureUpdateAction.NEVER,
    });
}

/** The library's context menu entries that copy the canvas to the clipboard as an image. */
const CopyAsImageEntries =
    '[data-testid="copyAsPng"], [data-testid="copyAsSvg"]';

/**
 * The library's copies to the clipboard (its canvas menu, Shift+Alt+C) read
 * the scene background as they start: it is made opaque just before, so the
 * image keeps the paper. The see-through canvas comes back with the next
 * frame, as for any opaque background without an export dialog.
 */
function useOpaqueImageCopies(api: ExcalidrawImperativeAPI | null): void {
    useEffect(() => {
        if (api === null) {
            return;
        }

        const paintOpaque = (): void =>
            flushSync(() =>
                api.updateScene({
                    appState: {
                        viewBackgroundColor: opaqueBackground(
                            api.getAppState().viewBackgroundColor,
                        ),
                    },
                    captureUpdate: CaptureUpdateAction.NEVER,
                }),
            );

        const onClick = (event: MouseEvent): void => {
            if (
                event.target instanceof Element &&
                event.target.closest(CopyAsImageEntries) !== null
            ) {
                paintOpaque();
            }
        };

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.code === 'KeyC' && event.altKey && event.shiftKey) {
                paintOpaque();
            }
        };

        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [api]);
}

/**
 * A phone opens the board fitted to its screen (MobileRituals), once the
 * library has loaded the scene; a board opened wide keeps its view when the
 * window narrows.
 */
function useFitOnPhoneOpen(
    api: ExcalidrawImperativeAPI | null,
    isPhone: boolean,
): void {
    const fitted = useRef<ExcalidrawImperativeAPI | null>(null);

    useEffect(() => {
        if (api === null || fitted.current === api) {
            return;
        }

        if (!isPhone) {
            fitted.current = api;

            return;
        }

        const fit = (): void => {
            if (fitted.current === api) {
                return;
            }

            fitted.current = api;
            fitToScreen(api, false);
        };

        if (!api.getAppState().isLoading) {
            fit();

            return;
        }

        return api.onChange((_elements, appState) => {
            if (appState.isLoading) {
                return;
            }

            // Outside the library's own update, which reports this change.
            queueMicrotask(fit);
        });
    }, [api, isPhone]);
}

type Props = {
    /** Null until the canvas is ready: no bar is shown. */
    api: ExcalidrawImperativeAPI | null;
    editing: boolean;
    isPhone: boolean;
    isFacilitator: boolean;
    /** The phone's read mode, for a phone viewer the lock does not hold. */
    readMode?: { reading: boolean; onChange: (reading: boolean) => void };
    /** The canvas background, told to the board's menu when it changes. */
    onBackgroundChange?: (color: string) => void;
    /** The facilitator's pill: first in the canvas, so the keyboard reaches it after the header and before the library. */
    facilitation?: ReactNode;
    /**
     * The library's canvas and what sits over it. The bars follow the canvas
     * frame by frame here, under the board: this element stays the same
     * object, so the library is not rendered again for them.
     */
    children: ReactNode;
};

/**
 * The canvas wrapper and the board's own bars over it (ScreenWhiteboard): the
 * dot grid of the paper lies under the see-through canvas, inverted in the
 * dark theme as the library inverts its canvas; the
 * library's chrome is hidden by `skrum-whiteboard--own-chrome`, and "Styles"
 * shows its property panel again through `skrum-whiteboard--styles`. On a
 * phone (MobileRituals) the read mode dock holds "Fit to screen" while
 * reading and the compact tool bar while editing; no zoom bar, history or
 * minimap (pinch zoom).
 */
export function BoardChrome({
    api,
    editing,
    isPhone,
    isFacilitator,
    readMode,
    onBackgroundChange,
    facilitation,
    children,
}: Props) {
    const { t } = useTrans();
    const canvas = useRef<HTMLDivElement | null>(null);
    const snapshot = useCanvasSnapshot(api);
    const [stylesChosen, setStylesChosen] = useState(false);
    const ready = api !== null && snapshot !== null;
    const background = snapshot?.appState.viewBackgroundColor;
    /** The library closes its own "shape" menu on a phone (a tap on it, Escape): the menu says whether it is open. */
    const stylesShown = isPhone
        ? snapshot?.appState.openMenu === 'shape'
        : stylesChosen;

    useCanvasKeyGuard(canvas);
    useFitOnPhoneOpen(api, isPhone);
    useOpaqueImageCopies(api);

    const dialog = snapshot?.appState.openDialog?.name;
    const paper = opaqueBackground(background ?? CANVAS_LIGHT);
    const view = snapshot?.view ?? { scrollX: 0, scrollY: 0, zoom: 1 };
    const dotSpacing = DotSpacing * view.zoom;

    useEffect(() => {
        if (background === undefined) {
            return;
        }

        onBackgroundChange?.(opaqueBackground(background));
    }, [background, onBackgroundChange]);

    /** The canvas is see-through over the dot grid, and opaque while an export dialog takes its background. */
    useEffect(() => {
        if (api === null || background === undefined) {
            return;
        }

        if (!isExportDialog(dialog)) {
            if (background !== seeThroughBackground(background)) {
                api.updateScene({
                    appState: {
                        viewBackgroundColor: seeThroughBackground(background),
                    },
                    captureUpdate: CaptureUpdateAction.NEVER,
                });
            }

            return;
        }

        if (background === opaqueBackground(background)) {
            return;
        }

        api.updateScene({ appState: { openDialog: null } });
        const frame = requestAnimationFrame(() =>
            openExportDialog(api, dialog),
        );

        return () => cancelAnimationFrame(frame);
    }, [api, background, dialog]);

    /** The phone's panel of shape actions opens only on the library's own "shape" menu. */
    const changeStyles = useCallback(
        (shown: boolean): void => {
            if (!isPhone) {
                setStylesChosen(shown);

                return;
            }

            api?.updateScene({
                appState: { openMenu: shown ? 'shape' : null },
            });
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
            {facilitation}
            <div
                aria-hidden="true"
                data-slot="whiteboard-paper"
                className="light bg-dotgrid absolute inset-0 dark:[filter:invert(93%)_hue-rotate(180deg)]"
                style={{
                    backgroundColor: paper,
                    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
                    backgroundPosition: `${view.scrollX * view.zoom}px ${view.scrollY * view.zoom}px`,
                    ...(dotSpacing < MinDotSpacing && {
                        backgroundImage: 'none',
                    }),
                }}
            />
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
                    bottomInset={isPhone ? PhoneDockBand : DesktopBarsBand}
                    topInset={isFacilitator ? FacilitationBand : 0}
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
