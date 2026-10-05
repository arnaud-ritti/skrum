import { FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    serializeAsJSON,
    type BinaryFiles,
    type ExcalidrawElement,
} from '@/lib/whiteboard/excalidraw';

type SceneAppState = Parameters<typeof serializeAsJSON>[1];

function sceneFileName(title: string): string {
    const safeTitle = title.replace(/[\\/:*?"<>|]+/g, ' ').trim();

    return `${safeTitle || 'whiteboard'}.whiteboard.json`;
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
            new Blob([serializeAsJSON(elements, appState, files, 'local')], {
                type: 'application/json',
            }),
        );
        const link = document.createElement('a');

        link.href = url;
        link.download = sceneFileName(title);
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    };

    return (
        <div
            data-slot="scene-export"
            className="flex w-full max-w-72 flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center text-card-foreground"
        >
            <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-full bg-skrum-primary-soft text-skrum-primary-text"
            >
                <FileJson className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
                {t('Download everything on the board as a data file.')}
            </p>
            <Button
                type="button"
                className="block h-auto min-h-9 max-w-full py-2 whitespace-normal"
                onClick={download}
            >
                {t('Download board data')}
            </Button>
        </div>
    );
}
