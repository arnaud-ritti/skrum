import { exportToBlob, exportToSvg } from '@/lib/whiteboard/excalidraw';
import { fileTitle, type BoardScene } from '@/lib/whiteboard/save-file';

export type ImageFormat = 'png' | 'svg';

export type ImageOptions = {
    format: ImageFormat;
    /** With the board's background; see-through without. */
    background: boolean;
    /** PNG only: an SVG has no pixel size. */
    scale: 1 | 2 | 3;
    selectionOnly: boolean;
};

export function imageFileName(title: string, format: ImageFormat): string {
    return `${fileTitle(title)}.${format}`;
}

function drawn(scene: BoardScene, selectionOnly: boolean) {
    const selected = scene.appState.selectedElementIds ?? {};

    return scene.elements.filter((element) => {
        if (element.isDeleted) {
            return false;
        }

        if (!selectionOnly) {
            return true;
        }

        // A selected shape comes with its text, a selected frame with what it holds.
        return [
            element.id,
            'containerId' in element ? element.containerId : null,
            element.frameId,
        ].some((id) => typeof id === 'string' && selected[id]);
    });
}

export function hasDrawing(scene: BoardScene): boolean {
    return drawn(scene, false).length > 0;
}

/**
 * The library's export functions reach this project untyped (their types sit
 * behind a path of its own packages), so what they take is spelled out here:
 * `exportBackground` in the state, the PNG's size through `getDimensions`.
 */
export async function exportImage(
    scene: BoardScene,
    options: ImageOptions,
): Promise<Blob> {
    const asked = {
        elements: drawn(scene, options.selectionOnly),
        appState: { ...scene.appState, exportBackground: options.background },
        files: scene.files,
    };

    if (options.format === 'svg') {
        return new Blob(
            [new XMLSerializer().serializeToString(await exportToSvg(asked))],
            { type: 'image/svg+xml' },
        );
    }

    return exportToBlob({
        ...asked,
        mimeType: 'image/png',
        getDimensions: (width: number, height: number) => ({
            width: width * options.scale,
            height: height * options.scale,
            scale: options.scale,
        }),
    });
}
