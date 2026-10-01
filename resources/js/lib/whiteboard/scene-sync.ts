import WhiteboardElementsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardElementsController';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    CaptureUpdateAction,
    reconcileElements,
    type ExcalidrawImperativeAPI,
} from './excalidraw';
import { FileRefusedError, downloadBoardFile, uploadBoardFile } from './files';
import { inIndexOrder, restoreScene } from './restore';
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
const MaxIdleFetches = 3;
const MaxRecoveryDelayMs = 30000;
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
    /** The highest seq any event or write response has announced. */
    let wantedSeq = seq;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let flushing = false;
    let disposed = false;
    let resyncing: Promise<void> | null = null;
    let recovering: Promise<void> | null = null;
    /** A remote change is missing from the canvas until the scene is reloaded. */
    let recoveryOwed = false;
    let recoveryFailures = 0;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;

    /** Nothing may report the board in step while a reload is still owed. */
    const setOffline = (offline: boolean) =>
        deps.onOffline(offline || recoveryOwed);

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

        const remote = restoreScene(elements);
        const merge = () =>
            setScene(
                reconcileElements(
                    scene() as never,
                    remote as never,
                    api.getAppState(),
                ) as unknown as SceneElement[],
            );

        try {
            merge();
        } catch {
            // Excalidraw's development build checks the indices at most once
            // a minute and throws on a flaw it otherwise repairs; the second
            // attempt gets the repair.
            try {
                merge();
            } catch (error) {
                console.error(
                    'whiteboard: a remote change was left out',
                    error,
                );

                // What never reached the canvas is not known to be held:
                // the server's scene has to replace ours.
                const shown = new Set(scene().map((element) => element.id));

                remember(elements.filter((element) => shown.has(element.id)));
                recover();

                return;
            }
        }

        remember(elements);
    };

    /** Replace local copies whatever their version: the server refused ours. */
    const force = (elements: SceneElement[]) => {
        const forced = new Map(
            restoreScene(elements).map((element) => [element.id, element]),
        );
        const local = new Map(scene().map((element) => [element.id, element]));

        setScene(
            inIndexOrder([
                ...[...local.values()].map(
                    (element) => forced.get(element.id) ?? element,
                ),
                ...[...forced.values()].filter(
                    (element) => !local.has(element.id),
                ),
            ]),
        );
        remember(elements);

        for (const element of elements) {
            const kept = local.get(element.id);

            // A server copy the canvas cannot show leaves ours in place;
            // sending ours again would only be refused again.
            if (kept && !forced.has(element.id)) {
                known.set(element.id, stamp(kept));
            }
        }
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

        let failed = false;
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
                wantedSeq = Math.max(wantedSeq, response.seq);

                if (response.fromSeq === seq) {
                    seq = response.seq;
                } else if (response.seq > seq) {
                    await resync();
                }
            }

            setOffline(false);
        } catch (error) {
            failed = true;

            if (isFatal(error)) {
                deps.onFatal(error);

                return;
            }

            requeue(batch);
            setOffline(true);
        } finally {
            flushing = false;

            if (pending.size > 0) {
                schedule(failed ? RetryDelayMs : FlushDelayMs);
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

    /**
     * The seq has moved past the change that could not be merged, so no later
     * delta brings it back: the reload is retried, with a growing delay, until
     * it succeeds. A request made while one is running or waiting joins it.
     */
    const recover = () => {
        recoveryOwed = true;

        if (recovering || recoveryTimer !== null || disposed) {
            return;
        }

        recovering = replaceScene()
            .then(() => {
                recoveryOwed = false;
                recoveryFailures = 0;

                if (disposed) {
                    return;
                }

                setOffline(false);

                // The snapshot may be older than an event applied meanwhile.
                if (seq < wantedSeq) {
                    void resync();
                }
            })
            .catch((error: unknown) => {
                if (isFatal(error)) {
                    deps.onFatal(error);

                    return;
                }

                console.error('whiteboard: the board was not reloaded', error);
                setOffline(true);

                if (disposed) {
                    return;
                }

                recoveryFailures += 1;
                recoveryTimer = setTimeout(
                    () => {
                        recoveryTimer = null;
                        recover();
                    },
                    Math.min(
                        RetryDelayMs * 2 ** (recoveryFailures - 1),
                        MaxRecoveryDelayMs,
                    ),
                );
            })
            .finally(() => {
                recovering = null;
            });
    };

    const fetchDelta = async () => {
        const delta = await retroRequest<ElementsDelta>(
            WhiteboardElementsController.index(boardId, {
                query: { since: seq },
            }),
        );

        applyRemote(delta.elements);
        seq = Math.max(seq, delta.seq);
    };

    /**
     * A change announced while a fetch was in flight may have been committed
     * after the server read the delta, so fetch again until the announced seq
     * is reached, whether or not the fetch that just ended brought anything:
     * an event is sent after its commit, so a fetch started after it holds
     * the change. A few fetches in a row that bring nothing end the loop; the
     * next event or poll takes over.
     */
    const resync = (): Promise<void> => {
        resyncing ??= (async () => {
            try {
                let idleFetches = 0;

                do {
                    const before = seq;

                    await fetchDelta();
                    idleFetches = seq > before ? 0 : idleFetches + 1;
                } while (
                    !disposed &&
                    seq < wantedSeq &&
                    idleFetches < MaxIdleFetches
                );

                setOffline(false);
            } catch (error) {
                if (isFatal(error)) {
                    deps.onFatal(error);
                } else if (
                    error instanceof RetroRequestError &&
                    error.status === 409
                ) {
                    // Older than the purge mark: no delta can catch up.
                    recover();
                } else {
                    setOffline(true);
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

                // Excalidraw inserts an image before it has computed its
                // file id; the change that sets the id queues the element.
                if (
                    element.type === 'image' &&
                    !element.isDeleted &&
                    typeof element.fileId !== 'string'
                ) {
                    continue;
                }

                pending.set(element.id, element);
            }

            if (pending.size > 0) {
                schedule(FlushDelayMs);
            }
        },
        handleRemote(payload) {
            wantedSeq = Math.max(wantedSeq, payload.seq);

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

            if (recoveryTimer !== null) {
                clearTimeout(recoveryTimer);
            }
        },
    };
}
