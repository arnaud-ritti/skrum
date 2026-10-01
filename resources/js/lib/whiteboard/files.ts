import WhiteboardFilesController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardFilesController';

function xsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return match ? decodeURIComponent(match[1]) : '';
}

function toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export class FileRefusedError extends Error {}

/** Resolves when the server holds the file; throws FileRefusedError on a 4xx. */
export async function uploadBoardFile(
    boardId: string,
    fileId: string,
    dataUrl: string,
): Promise<void> {
    const blob = await (await fetch(dataUrl)).blob();
    const body = new FormData();

    body.append('file_id', fileId);
    body.append('file', blob, fileId);

    const response = await fetch(WhiteboardFilesController.store.url(boardId), {
        method: 'POST',
        body,
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': xsrfToken() },
    });

    if (response.ok) {
        return;
    }

    if (response.status >= 400 && response.status < 500) {
        throw new FileRefusedError(String(response.status));
    }

    throw new Error(`upload failed: ${response.status}`);
}

export async function downloadBoardFile(
    boardId: string,
    fileId: string,
): Promise<{ dataURL: string; mimeType: string }> {
    const response = await fetch(
        WhiteboardFilesController.show.url({ board: boardId, fileId }),
        { credentials: 'same-origin' },
    );

    if (!response.ok) {
        throw new Error(`download failed: ${response.status}`);
    }

    const blob = await response.blob();

    return { dataURL: await toDataUrl(blob), mimeType: blob.type };
}
