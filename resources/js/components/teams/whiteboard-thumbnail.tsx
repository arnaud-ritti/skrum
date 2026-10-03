import { WhiteboardPreviewShapes } from '@/components/teams/whiteboard-template-preview';
import type { WhiteboardPreview } from '@/types';

/**
 * The 6.5rem picture of a board above its name: the board's shapes on the
 * dotted paper, the paper alone while no preview is built or the board is
 * empty. The paper stays white in both themes, as the scene's colours are.
 */
export function WhiteboardThumbnail({
    preview,
}: {
    preview: WhiteboardPreview | null;
}) {
    return (
        <span
            aria-hidden="true"
            data-slot="whiteboard-thumbnail"
            className="bg-whiteboard-dotgrid block h-26 overflow-hidden border-b p-3"
        >
            {preview !== null && preview.shapes.length > 0 && (
                <WhiteboardPreviewShapes
                    preview={preview}
                    className="size-full"
                />
            )}
        </span>
    );
}
