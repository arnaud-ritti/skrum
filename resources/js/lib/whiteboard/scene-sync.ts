import WhiteboardElementsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardElementsController';
import WhiteboardSnapshotsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardSnapshotsController';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    CaptureUpdateAction,
    closeTextEditor,
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
    /** `elementId` is null when the server could not read an id. */
    onRejected: (reason: RejectReason, elementId: string | null) => void;
    onOffline: (offline: boolean) => void;
    /** The board is locked for this member: unsent edits were dropped. */
    onLocked: () => void;
};

export type SceneSync = {
    /** `editingTextId` is the text element open in the canvas's editor. */
    handleChange(
        elements: readonly SceneElement[],
        editingTextId: string | null,
    ): void;
    handleRemote(payload: ElementsChangedPayload): void;
    resync(): Promise<void>;
    dispose(): void;
};

const stamp = (element: SceneElement) =>
    `${element.version}:${element.versionNonce}`;

const heightOf = (element: SceneElement) =>
    typeof element.height === 'number' ? element.height : 0;

type Seen = {
    stamp: string;
    height: number;
    version: number;
    versionNonce: number;
};

const isFatal = (error: unknown): error is RetroRequestError =>
    error instanceof RetroRequestError && FatalStatuses.includes(error.status);

const isLocked = (error: unknown): error is RetroRequestError =>
    error instanceof RetroRequestError &&
    error.status === 403 &&
    'locked' in error.errors;

export function createSceneSync(deps: SceneSyncDeps): SceneSync {
    const { api, boardId } = deps;
    /** What the server is known to hold, per element. */
    const known = new Map<string, string>();
    const pending = new Map<string, SceneElement>();
    const files = new Set<string>();
    /** Each element as the canvas last reported it or as we last set it. */
    const seen = new Map<string, Seen>();
    /** Off once the canvas has shown that it no longer answers to it. */
    let keepsContainerHeights = true;
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
    /** The next reload drops what the server does not hold (locked board). */
    let discarding = false;

    /** Nothing may report the board in step while a reload is still owed. */
    const setOffline = (offline: boolean) =>
        deps.onOffline(offline || recoveryOwed);

    const scene = () =>
        api.getSceneElementsIncludingDeleted() as unknown as SceneElement[];

    const see = (element: SceneElement) => {
        const current = stamp(element);

        if (seen.get(element.id)?.stamp === current) {
            return;
        }

        seen.set(element.id, {
            stamp: current,
            height: heightOf(element),
            version: element.version,
            versionNonce: element.versionNonce,
        });
    };

    const setScene = (elements: SceneElement[]) => {
        // Before the canvas has it: an open text editor reacts at once.
        elements.forEach(see);
        api.updateScene({
            elements: elements as never,
            captureUpdate: CaptureUpdateAction.NEVER,
        });
    };

    /**
     * Excalidraw 0.18.1 remembers the height a container had when its text
     * was first edited in this browser (`originalContainerCache`, not
     * exported). Whenever the text editor finds the container taller than
     * that with room around the text, it shrinks the container onto the text
     * (`updateWysiwygStyle`). Only a resize made here clears that memory, so
     * a note that somebody else made taller collapses into a strip the
     * moment its text is edited, or when it is resized from elsewhere during
     * the edit. The editor rewrites its memory with the current height when
     * the text's font is not the one it shows, which is the only handle the
     * library leaves: the height is put back together with a font size one
     * off, then the font size is put back. A container that gets shorter
     * with its text (lines were deleted) is the library doing its job and is
     * left alone.
     */
    const keepContainerHeight = (
        elements: readonly SceneElement[],
        textId: string,
    ): boolean => {
        if (!keepsContainerHeights) {
            return false;
        }

        const text = elements.find((element) => element.id === textId);
        const container = elements.find(
            (element) => element.id === text?.containerId,
        );

        if (
            !text ||
            !container ||
            container.isDeleted ||
            container.type === 'arrow' ||
            typeof text.fontSize !== 'number'
        ) {
            return false;
        }

        const before = seen.get(container.id);
        const textBefore = seen.get(text.id);

        if (!before || heightOf(container) >= before.height) {
            return false;
        }

        if (textBefore && heightOf(text) < textBefore.height) {
            return false;
        }

        const fontSize = text.fontSize;
        // The shrink was the only change: the element is what it was.
        const restored: SceneElement =
            container.version === before.version + 1
                ? {
                      ...container,
                      height: before.height,
                      version: before.version,
                      versionNonce: before.versionNonce,
                  }
                : { ...container, height: before.height };
        const withFontSize = (size: number) =>
            scene().map((element) =>
                element.id === text.id
                    ? { ...element, fontSize: size }
                    : element,
            );

        setScene(
            withFontSize(fontSize + 1).map((element) =>
                element.id === container.id ? restored : element,
            ),
        );
        setScene(withFontSize(fontSize));

        const kept = scene().find((element) => element.id === container.id);

        if (!kept || heightOf(kept) < before.height) {
            keepsContainerHeights = false;
            console.error(
                'whiteboard: the text editor shrank a note and it could not be undone',
            );
        }

        return true;
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
                deps.onRejected('file', element.id);
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
                deps.onRejected(rejection.reason, rejection.id);
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

            if (isLocked(error)) {
                failed = false;
                discard();
                deps.onLocked();

                return;
            }

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
        const dropsLocal = discarding;
        const keepsLocal = (element: SceneElement) =>
            !dropsLocal && (pending.has(element.id) || !known.has(element.id));

        setScene(
            scene().map((element) =>
                alive.has(element.id) || keepsLocal(element)
                    ? element
                    : { ...element, isDeleted: true },
            ),
        );
        remember(scene().filter((element) => !alive.has(element.id)));
        force(snapshot.elements);
        seq = snapshot.seq;

        if (dropsLocal) {
            discarding = false;
        }
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

                // A discard asked for while a reload was running.
                if (discarding && !disposed && recoveryTimer === null) {
                    recover();
                }
            });
    };

    /** The board is locked for us: what we have not sent is dropped (spec §11.2). */
    const discard = () => {
        // What an open text editor holds is unsent too, and it would write
        // it back over the reloaded scene at the next key.
        closeTextEditor();
        pending.clear();
        discarding = true;
        recover();
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
    deps.initial.elements.forEach(see);

    return {
        handleChange(elements, editingTextId) {
            if (
                editingTextId !== null &&
                keepContainerHeight(elements, editingTextId)
            ) {
                // The scene was put right; the canvas reports it again.
                return;
            }

            for (const element of elements) {
                see(element);

                // Dropped with the rest when the reload lands.
                if (discarding) {
                    continue;
                }

                const held = known.get(element.id);

                if (held === stamp(element)) {
                    continue;
                }

                if (held === undefined && element.isDeleted) {
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
