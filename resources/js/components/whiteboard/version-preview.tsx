import { usePage } from '@inertiajs/react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import WhiteboardVersionsController from '@/actions/App/Http/Controllers/Whiteboards/WhiteboardVersionsController';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import {
    CanvasLocales,
    isDark,
    subscribeToTheme,
} from '@/lib/whiteboard/appearance';
import {
    Excalidraw,
    MainMenu,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import { downloadBoardFile } from '@/lib/whiteboard/files';
import { restoreScene } from '@/lib/whiteboard/restore';
import type {
    WhiteboardVersionScene,
    WhiteboardVersionSummary,
} from '@/lib/whiteboard/types';

type Props = {
    boardId: string;
    version: WhiteboardVersionSummary | null;
    title: string;
    date: string;
    onClose: () => void;
};

export function VersionPreview({
    boardId,
    version,
    title,
    date,
    onClose,
}: Props) {
    return (
        <Dialog
            open={version !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className="flex h-[85vh] flex-col sm:max-w-6xl"
                aria-describedby={undefined}
            >
                <DialogTitle>
                    {title}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {date}
                    </span>
                </DialogTitle>
                {version !== null && (
                    <PreviewCanvas boardId={boardId} versionId={version.id} />
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * A second canvas, read-only, fed once: no onChange, no scene sync, no
 * cursors. Nothing done here is written anywhere.
 */
function PreviewCanvas({
    boardId,
    versionId,
}: {
    boardId: string;
    versionId: string;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const dark = useSyncExternalStore(subscribeToTheme, isDark, () => false);
    const [scene, setScene] = useState<WhiteboardVersionScene | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
    const failure = t('Something went wrong. Please try again.');

    useEffect(() => {
        let cancelled = false;

        retroRequest<WhiteboardVersionScene>(
            WhiteboardVersionsController.show({
                board: boardId,
                version: versionId,
            }),
        )
            .then((fetched) => {
                if (!cancelled) {
                    setScene(fetched);
                }
            })
            .catch((caught: unknown) => {
                if (!cancelled) {
                    setError(
                        caught instanceof RetroRequestError && caught.status > 0
                            ? caught.message
                            : failure,
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [boardId, versionId, failure]);

    useEffect(() => {
        if (!api || !scene) {
            return;
        }

        let cancelled = false;

        // The dialog opens with a zoom: the canvas measured itself too early.
        const settled = setTimeout(() => api.refresh(), 300);

        for (const file of scene.files) {
            downloadBoardFile(boardId, file.id)
                .then(({ dataURL, mimeType }) => {
                    if (cancelled) {
                        return;
                    }

                    api.addFiles([
                        {
                            id: file.id,
                            dataURL,
                            mimeType,
                            created: Date.now(),
                        } as never,
                    ]);
                })
                .catch(() => undefined);
        }

        return () => {
            cancelled = true;
            clearTimeout(settled);
        };
    }, [api, scene, boardId]);

    if (error !== null) {
        return (
            <p role="alert" className="text-sm text-muted-foreground">
                {error}
            </p>
        );
    }

    if (scene === null) {
        return <Skeleton className="min-h-0 flex-1" />;
    }

    return (
        <div className="whiteboard-preview relative min-h-0 flex-1">
            <Excalidraw
                excalidrawAPI={setApi}
                initialData={{
                    elements: restoreScene(scene.elements) as never,
                    scrollToContent: true,
                }}
                viewModeEnabled
                langCode={CanvasLocales[locale as string] ?? 'en'}
                theme={dark ? 'dark' : 'light'}
                aiEnabled={false}
                UIOptions={{
                    canvasActions: {
                        loadScene: false,
                        saveToActiveFile: false,
                        toggleTheme: false,
                        export: false,
                        saveAsImage: false,
                        clearCanvas: false,
                        changeViewBackgroundColor: false,
                    },
                }}
            >
                {/* Without a menu of ours the canvas renders its own, with links to the library's sites. */}
                <MainMenu />
            </Excalidraw>
        </div>
    );
}
