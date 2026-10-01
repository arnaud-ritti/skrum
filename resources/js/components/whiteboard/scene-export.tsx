import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    serializeAsJSON,
    type BinaryFiles,
    type ExcalidrawElement,
} from '@/lib/whiteboard/excalidraw';

type SceneAppState = Parameters<typeof serializeAsJSON>[1];

export function sceneFileName(title: string): string {
    const safeTitle = title.replace(/[\\/:*?"<>|]+/g, ' ').trim();

    return `${safeTitle || 'whiteboard'}.whiteboard.json`;
}

function sceneAsJson(
    elements: readonly ExcalidrawElement[],
    appState: SceneAppState,
    files: BinaryFiles,
): string {
    const scene = JSON.parse(
        serializeAsJSON(elements, appState, files, 'local'),
    ) as Record<string, unknown>;

    return JSON.stringify(
        { ...scene, source: window.location.origin },
        null,
        2,
    );
}

export function SceneExport({
    title,
    elements,
    appState,
    files,
}: {
    title: string;
    elements: readonly ExcalidrawElement[];
    appState: SceneAppState;
    files: BinaryFiles;
}) {
    const { t } = useTrans();

    const download = (): void => {
        const url = URL.createObjectURL(
            new Blob([sceneAsJson(elements, appState, files)], {
                type: 'application/json',
            }),
        );
        const link = document.createElement('a');

        link.href = url;
        link.download = sceneFileName(title);
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col items-start gap-3 p-2">
            <p className="text-sm">
                {t('Download everything on the board as a data file.')}
            </p>
            <Button type="button" onClick={download}>
                {t('Download board data')}
            </Button>
        </div>
    );
}
