import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroRequestError } from '@/lib/retro/api';
import { createSceneSync } from './scene-sync';
import type { SceneElement } from './types';

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    download: vi.fn(),
    upload: vi.fn(),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: mocks.request,
}));

vi.mock('./excalidraw', () => ({
    CaptureUpdateAction: { NEVER: 'never' },
    closeTextEditor: () => {},
    reconcileElements: (_local: unknown, remote: unknown) => remote,
}));

vi.mock('./restore', () => ({
    restoreScene: (elements: unknown) => elements,
    inIndexOrder: (elements: unknown) => elements,
}));

vi.mock('./files', () => ({
    FileRefusedError: class extends Error {},
    downloadBoardFile: mocks.download,
    uploadBoardFile: mocks.upload,
}));

function element(
    id: string,
    overrides: Partial<SceneElement> = {},
): SceneElement {
    return {
        id,
        type: 'rectangle',
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        ...overrides,
    };
}

function setup(initial: SceneElement[] = []) {
    let elements = [...initial];
    const api = {
        getSceneElementsIncludingDeleted: () => elements,
        updateScene: vi.fn(
            ({ elements: next }: { elements: SceneElement[] }) => {
                elements = next;
            },
        ),
        getAppState: () => ({}),
        getFiles: () => ({}),
        addFiles: vi.fn(),
    };
    const deps = {
        onFatal: vi.fn(),
        onRejected: vi.fn(),
        onOffline: vi.fn(),
        onLocked: vi.fn(),
    };
    const sync = createSceneSync({
        boardId: 'board',
        api: api as never,
        initial: { elements: initial, seq: 1 },
        ...deps,
    });

    return { sync, api, deps };
}

const accepted = { seq: 2, fromSeq: 1, rejected: [] };

beforeEach(() => {
    vi.useFakeTimers();
    mocks.request.mockReset();
    mocks.download.mockReset();
    mocks.upload.mockReset();
    mocks.download.mockResolvedValue({
        dataURL: 'data:',
        mimeType: 'image/png',
    });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('createSceneSync', () => {
    it('stops sending once the access to the board ended', async () => {
        mocks.request.mockRejectedValue(new RetroRequestError(403, ''));
        const { sync, deps } = setup();

        sync.handleChange([element('a')], null);
        await vi.advanceTimersByTimeAsync(300);
        sync.handleChange([element('b')], null);
        await vi.advanceTimersByTimeAsync(5000);

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(deps.onFatal).toHaveBeenCalledTimes(1);
    });

    it('reloads a locked board once when the reload finds the access ended', async () => {
        mocks.request.mockImplementation((route: { url: string }) =>
            Promise.reject(
                route.url.includes('snapshot')
                    ? new RetroRequestError(419, '')
                    : new RetroRequestError(403, '', { locked: ['locked'] }),
            ),
        );
        const { sync, deps } = setup();

        sync.handleChange([element('a')], null);
        await vi.advanceTimersByTimeAsync(300);
        await vi.advanceTimersByTimeAsync(5000);

        expect(mocks.request).toHaveBeenCalledTimes(2);
        expect(deps.onFatal).toHaveBeenCalledTimes(1);
    });

    it('never downloads the file of a deleted image', () => {
        setup([
            element('img', { type: 'image', fileId: 'f', isDeleted: true }),
        ]);

        expect(mocks.download).not.toHaveBeenCalled();
    });

    it('sends a move of a server image whose download failed, without uploading it', async () => {
        mocks.download.mockRejectedValue(new Error('download failed: 500'));
        mocks.request.mockResolvedValue(accepted);
        const image = element('img', { type: 'image', fileId: 'f' });
        const { sync } = setup([image]);

        await vi.advanceTimersByTimeAsync(0);
        sync.handleChange([{ ...image, version: 2, x: 10 }], null);
        await vi.advanceTimersByTimeAsync(300);

        expect(mocks.upload).not.toHaveBeenCalled();
        expect(mocks.request).toHaveBeenCalledTimes(1);
    });

    it('leaves the canvas alone when a reload answers after it was disposed', async () => {
        let answer: (snapshot: unknown) => void = () => {};
        mocks.request.mockImplementation(
            (route: { url: string }) =>
                new Promise((resolve, reject) => {
                    if (route.url.includes('snapshot')) {
                        answer = resolve;

                        return;
                    }

                    reject(new RetroRequestError(409, ''));
                }),
        );
        const { sync, api } = setup();

        await sync.resync();
        sync.dispose();
        answer({ elements: [element('z')], seq: 9 });
        await vi.advanceTimersByTimeAsync(0);

        expect(api.updateScene).not.toHaveBeenCalled();
    });

    it('sends nothing of an element deleted before it was ever sent', async () => {
        mocks.request.mockResolvedValue(accepted);
        const { sync } = setup();
        const drawn = element('a');

        sync.handleChange([drawn], null);
        sync.handleChange(
            [{ ...drawn, version: 2, versionNonce: 2, isDeleted: true }],
            null,
        );
        await vi.advanceTimersByTimeAsync(5000);

        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('sends the deletion of an element whose first write is still in flight', async () => {
        let answer: (response: unknown) => void = () => {};
        mocks.request.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    answer = resolve;
                }),
        );
        mocks.request.mockResolvedValue({ seq: 3, fromSeq: 2, rejected: [] });
        const { sync } = setup();
        const drawn = element('a');

        sync.handleChange([drawn], null);
        await vi.advanceTimersByTimeAsync(300);
        sync.handleChange(
            [{ ...drawn, version: 2, versionNonce: 2, isDeleted: true }],
            null,
        );
        answer(accepted);
        await vi.advanceTimersByTimeAsync(5000);

        expect(mocks.request).toHaveBeenCalledTimes(2);
        expect(mocks.request.mock.calls[1][1]).toEqual({
            elements: [
                { ...drawn, version: 2, versionNonce: 2, isDeleted: true },
            ],
        });
    });
});
