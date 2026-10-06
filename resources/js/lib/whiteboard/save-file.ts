import {
    serializeAsJSON,
    type BinaryFiles,
    type ExcalidrawElement,
} from '@/lib/whiteboard/excalidraw';

/** What the canvas holds at one moment, as its export functions take it. */
export type BoardScene = {
    elements: readonly ExcalidrawElement[];
    appState: Parameters<typeof serializeAsJSON>[1];
    files: BinaryFiles;
};

/** The board's title as a file name, without the characters a file system refuses. */
export function fileTitle(title: string): string {
    return title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'whiteboard';
}

export function saveFile(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = name;
    link.click();
    // The browser reads the address after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function saveBoardData(title: string, scene: BoardScene): void {
    saveFile(
        new Blob(
            [
                serializeAsJSON(
                    scene.elements,
                    scene.appState,
                    scene.files,
                    'local',
                ),
            ],
            { type: 'application/json' },
        ),
        `${fileTitle(title)}.whiteboard.json`,
    );
}
