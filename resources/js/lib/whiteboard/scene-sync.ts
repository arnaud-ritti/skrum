import WhiteboardElementsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardElementsController';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    CaptureUpdateAction,
    reconcileElements,
    restoreElements,
    type ExcalidrawImperativeAPI,
} from './excalidraw';
import { FileRefusedError, downloadBoardFile, uploadBoardFile } from './files';
import type {
    ElementsChangedPayload,
    ElementsDelta,
    RejectReason,
    SceneElement,
    WhiteboardSnapshot,
    WriteResponse,
} from './types';

const FlushDelayMs = 300;
const RetryDelayMs = 2000;
const MaxBatch = 200;
const FatalStatuses = [401, 403, 404, 419];

export type SceneSyncDeps = {
    boardId: string;
    api: ExcalidrawImperativeAPI;
    initial: Pick<WhiteboardSnapshot, 'elements' | 'seq'>;
    onFatal: (error: RetroRequestError) => void;
    onRejected: (reason: RejectReason) => void;
    onOffline: (offline: boolean) => void;
};

export type SceneSync = {
    handleChange(elements: readonly SceneElement[]): void;
    handleRemote(payload: ElementsChangedPayload): void;
    resync(): Promise<void>;
    dispose(): void;
};

const stamp = (element: SceneElement) =>
    `${element.version}:${element.versionNonce}`;

const isFatal = (error: unknown): error is RetroRequestError =>
    error instanceof RetroRequestError && FatalStatuses.includes(error.status);

export function createSceneSync(deps: SceneSyncDeps): SceneSync {
    const { api, boardId } = deps;
    /** What the server is known to hold, per element. */
    const known = new Map<string, string>();
    const pending = new Map<string, SceneElement>();
    const files = new Set<string>();
    let seq = deps.initial.seq;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let flushing = false;
    let disposed = false;
    let resyncing: Promise<void> | null = null;

    const scene = () =>
        api.getSceneElementsIncludingDeleted() as unknown as SceneElement[];

    const setScene = (elements: SceneElement[]) => {
        api.updateScene({
            elements: elements as never,
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    };

    const loadFile = (element: SceneElement) => {
        const fileId = element.fileId;

        if (
            element.type !== 'image' ||
            typeof fileId !== 'string' ||
            files.has(fileId)
        ) {
            return;
        }

        files.add(fileId);

        downloadBoardFile(boardId, fileId)
            .then(({ dataURL, mimeType }) => {
                if (disposed) {
                    return;
                }

                api.addFiles([
                    {
                        id: fileId,
                        dataURL,
                        mimeType,
                        created: Date.now(),
                    } as never,
                ]);
            })
            .catch(() => files.delete(fileId));
    };

    const remember = (elements: readonly SceneElement[]) => {
        for (const element of elements) {
            known.set(element.id, stamp(element));
            loadFile(element);
        }
    };

    /** Merge by Excalidraw's rule: the local copy survives when it is newer. */
    const applyRemote = (elements: SceneElement[]) => {
        if (elements.length === 0) {
            return;
        }

        const remote = restoreElements(elements as never, null);

        setScene(
            reconcileElements(
                scene() as never,
                remote as never,
                api.getAppState(),
            ) as unknown as SceneElement[],
        );
        remember(elements);
    };

    /** Replace local copies whatever their version: the server refused ours. */
    const force = (elements: SceneElement[]) => {
        const byId = new Map(elements.map((element) => [element.id, element]));
        const merged = scene().map((element) => {
            const forced = byId.get(element.id);

            byId.delete(element.id);

            return forced ?? element;
        });

        setScene(
            restoreElements(
                [...merged, ...byId.values()] as never,
                null,
            ) as unknown as SceneElement[],
        );
        remember(elements);
    };

    const dropLocally = (id: string) => {
        const local = scene().find((element) => element.id === id);

        if (!local) {
            return;
        }

        pending.delete(id);
        known.set(id, stamp(local));
        setScene(
            scene().map((element) =>
                element.id === id ? { ...element, isDeleted: true } : element,
            ),
        );
        known.set(id, stamp(scene().find((element) => element.id === id)!));
    };

    const schedule = (delay: number) => {
        if (timer !== null || disposed) {
            return;
        }

        timer = setTimeout(() => {
            timer = null;
            void flush();
        }, delay);
    };

    const requeue = (elements: SceneElement[]) => {
        for (const element of elements) {
            if (!pending.has(element.id)) {
                pending.set(element.id, element);
            }
        }
    };

    /** Images go up before the element that shows them (spec §6.5). */
    const withUploadedFiles = async (
        batch: SceneElement[],
    ): Promise<SceneElement[]> => {
        const ready: SceneElement[] = [];

        for (const element of batch) {
            const fileId = element.fileId;

            if (
                element.type !== 'image' ||
                element.isDeleted ||
                typeof fileId !== 'string' ||
                files.has(fileId)
            ) {
                ready.push(element);

                continue;
            }

            const file = api.getFiles()[fileId];

            if (!file) {
                requeue([element]);

                continue;
            }

            try {
                await uploadBoardFile(boardId, fileId, file.dataURL);
                files.add(fileId);
                ready.push(element);
            } catch (error) {
                if (!(error instanceof FileRefusedError)) {
                    throw error;
                }

                dropLocally(element.id);
                deps.onRejected('file');
            }
        }

        return ready;
    };

    const settle = (response: WriteResponse) => {
        for (const rejection of response.rejected) {
            if (rejection.element) {
                force([rejection.element]);
            } else if (rejection.id) {
                dropLocally(rejection.id);
            }

            if (rejection.reason !== 'stale') {
                deps.onRejected(rejection.reason);
            }
        }
    };

    const flush = async (): Promise<void> => {
        if (flushing || disposed || pending.size === 0) {
            return;
        }

        flushing = true;

        const batch = [...pending.values()].slice(0, MaxBatch);

        for (const element of batch) {
            pending.delete(element.id);
        }

        try {
            const ready = await withUploadedFiles(batch);

            if (ready.length > 0) {
                const response = await retroRequest<WriteResponse>(
                    WhiteboardElementsController.update(boardId),
                    { elements: ready },
                );

                for (const element of ready) {
                    known.set(element.id, stamp(element));
                }

                settle(response);

                if (response.fromSeq === seq) {
                    seq = response.seq;
                } else if (response.seq > seq) {
                    await resync();
                }
            }

            deps.onOffline(false);
        } catch (error) {
            if (isFatal(error)) {
                deps.onFatal(error);

                return;
            }

            requeue(batch);
            deps.onOffline(true);
        } finally {
            flushing = false;

            if (pending.size > 0) {
                schedule(RetryDelayMs);
            }
        }
    };

    /** The server purged tombstones we never saw: start from its scene. */
    const replaceScene = async () => {
        const snapshot = await retroRequest<WhiteboardSnapshot>(
            WhiteboardSnapshotsController.show(boardId),
        );
        const alive = new Set(snapshot.elements.map((element) => element.id));

        setScene(
            scene().map((element) =>
                alive.has(element.id) ||
                pending.has(element.id) ||
                !known.has(element.id)
                    ? element
                    : { ...element, isDeleted: true },
            ),
        );
        remember(scene().filter((element) => !alive.has(element.id)));
        force(snapshot.elements);
        seq = snapshot.seq;
    };

    const resync = (): Promise<void> => {
        resyncing ??= (async () => {
            try {
                const delta = await retroRequest<ElementsDelta>(
                    WhiteboardElementsController.index(boardId, {
                        query: { since: seq },
                    }),
                );

                applyRemote(delta.elements);
                seq = Math.max(seq, delta.seq);
                deps.onOffline(false);
            } catch (error) {
                if (isFatal(error)) {
                    deps.onFatal(error);
                } else if (
                    error instanceof RetroRequestError &&
                    error.status === 409
                ) {
                    await replaceScene().catch(() => deps.onOffline(true));
                } else {
                    deps.onOffline(true);
                }
            } finally {
                resyncing = null;
            }
        })();

        return resyncing;
    };

    remember(deps.initial.elements);

    return {
        handleChange(elements) {
            for (const element of elements) {
                const seen = known.get(element.id);

                if (seen === stamp(element)) {
                    continue;
                }

                if (seen === undefined && element.isDeleted) {
                    continue;
                }

                pending.set(element.id, element);
            }

            if (pending.size > 0) {
                schedule(FlushDelayMs);
            }
        },
        handleRemote(payload) {
            if (payload.seq <= seq) {
                return;
            }

            if (payload.elements && payload.fromSeq === seq) {
                applyRemote(payload.elements);
                seq = payload.seq;

                return;
            }

            void resync();
        },
        resync,
        dispose() {
            disposed = true;

            if (timer !== null) {
                clearTimeout(timer);
            }
        },
    };
}
