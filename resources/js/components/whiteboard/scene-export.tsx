import { FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { saveBoardData, type BoardScene } from '@/lib/whiteboard/save-file';

export function SceneExport({
    title,
    elements,
    appState,
    files,
}: BoardScene & { title: string }) {
    const { t } = useTrans();

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
                onClick={() =>
                    saveBoardData(title, { elements, appState, files })
                }
            >
                {t('Download board data')}
            </Button>
        </div>
    );
}
