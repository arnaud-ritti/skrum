import type { ReactNode } from 'react';
import { WhiteboardColorBar } from '@/components/skrum/whiteboard-toolbar';
import {
    filledSelection,
    type ColorBarState,
    type ColorElement,
} from '@/lib/whiteboard/canvas-colors';
import {
    CaptureUpdateAction,
    type ExcalidrawImperativeAPI,
} from '@/lib/whiteboard/excalidraw';
import {
    postItAppState,
    recolorElements,
    type PostItColor,
} from '@/lib/whiteboard/palette';

type Props = {
    api: ExcalidrawImperativeAPI;
    state: ColorBarState;
    /** Place of the actions on a selection ("Convert to actions", plan WB-5). */
    selectionActions?: ReactNode;
};

/**
 * The eight colours, in place of the canvas's own quick picks (answer 7-D3):
 * under the tool bar, as the sub-bar of the WhiteboardToolbar mockup. A colour
 * recolours the selected shapes that have a fill and becomes the fill of the
 * next ones.
 */
export function CanvasColors({ api, state, selectionActions }: Props) {
    if (!state.visible) {
        return null;
    }

    const apply = (color: PostItColor): void => {
        const elements = api.getSceneElementsIncludingDeleted();
        const selected = filledSelection(
            elements as unknown as ColorElement[],
            api.getAppState().selectedElementIds,
        ).map((element) => element.id);

        api.updateScene({
            ...(selected.length > 0 && {
                elements: recolorElements(elements, selected, color),
            }),
            appState: postItAppState(color) as never,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
    };

    return (
        <div
            data-slot="canvas-colors"
            className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center gap-2 px-4"
        >
            <WhiteboardColorBar
                value={state.value}
                onChange={apply}
                className="pointer-events-auto"
            />
            {selectionActions}
        </div>
    );
}
