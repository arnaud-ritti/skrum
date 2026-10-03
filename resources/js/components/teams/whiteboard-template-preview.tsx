import { cn } from '@/lib/utils';
import type { WhiteboardPreview, WhiteboardPreviewShape } from '@/types';

function ShapeMark({
    shape,
    strokeWidth,
}: {
    shape: WhiteboardPreviewShape;
    strokeWidth: number;
}) {
    const { x, y, width, height } = shape;
    const common = {
        fill: shape.fill ?? 'none',
        stroke: shape.stroke ?? 'none',
        strokeWidth,
    };

    if (shape.kind === 'ellipse') {
        return (
            <ellipse
                cx={x + width / 2}
                cy={y + height / 2}
                rx={width / 2}
                ry={height / 2}
                {...common}
            />
        );
    }

    if (shape.kind === 'diamond') {
        const points = [
            [x + width / 2, y],
            [x + width, y + height / 2],
            [x + width / 2, y + height],
            [x, y + height / 2],
        ]
            .map((point) => point.join(','))
            .join(' ');

        return <polygon points={points} {...common} />;
    }

    if (shape.kind === 'path') {
        const points = shape.points
            .map(([pointX, pointY]) => `${pointX},${pointY}`)
            .join(' ');

        return <polyline points={points} {...common} fill="none" />;
    }

    if (shape.kind === 'text') {
        return (
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                stroke="none"
                className="fill-whiteboard-paper-line"
            />
        );
    }

    return <rect x={x} y={y} width={width} height={height} {...common} />;
}

/** The shapes of a scene, scaled to fit the box the class gives the drawing. */
export function WhiteboardPreviewShapes({
    preview,
    className,
}: {
    preview: WhiteboardPreview;
    className?: string;
}) {
    const strokeWidth = Math.max(preview.width, preview.height) / 200;

    return (
        <svg
            viewBox={`0 0 ${preview.width || 1} ${preview.height || 1}`}
            preserveAspectRatio="xMidYMid meet"
            className={className}
            aria-hidden="true"
        >
            {preview.shapes.map((shape, index) => (
                <ShapeMark
                    key={index}
                    shape={shape}
                    strokeWidth={strokeWidth}
                />
            ))}
        </svg>
    );
}

/**
 * The outline of a whiteboard scene. Fills and strokes are the scene's own
 * colours (canvas data), so the paper is white in both themes.
 */
export function WhiteboardTemplatePreview({
    preview,
    className,
}: {
    preview: WhiteboardPreview;
    className?: string;
}) {
    return (
        <div
            data-slot="whiteboard-template-preview"
            className={cn(
                'rounded-md border bg-whiteboard-paper p-2',
                className,
            )}
        >
            <WhiteboardPreviewShapes
                preview={preview}
                className="h-24 w-full"
            />
        </div>
    );
}
