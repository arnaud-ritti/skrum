import { useTrans } from '@/hooks/use-trans';
import {
    useCanvasView,
    useMaskedNoteBoxes,
} from '@/hooks/use-whiteboard-overlay';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';

/**
 * "•••" on every note whose text the server kept from this viewer (spec
 * §11.5). Same layer as the vote badges: above the drawing, under the
 * canvas's own controls, and never in the way of a click.
 */
export function MaskedNotes({ api }: { api: ExcalidrawImperativeAPI }) {
    const { t } = useTrans();
    const view = useCanvasView(api);
    const boxes = useMaskedNoteBoxes(api);

    if (!view) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
            {boxes.map((box) => (
                <span
                    key={box.id}
                    role="img"
                    aria-label={t('Hidden note')}
                    className="absolute flex items-center justify-center text-foreground/60 select-none"
                    style={{
                        left: (box.x + view.scrollX) * view.zoom,
                        top: (box.y + view.scrollY) * view.zoom,
                        width: box.width * view.zoom,
                        height: box.height * view.zoom,
                        fontSize: Math.max(12, 28 * view.zoom),
                        transform: `rotate(${box.angle}rad)`,
                    }}
                >
                    •••
                </span>
            ))}
        </div>
    );
}
