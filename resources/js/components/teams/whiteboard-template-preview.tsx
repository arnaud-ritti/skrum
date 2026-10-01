import type { WhiteboardPreview, WhiteboardPreviewShape } from '@/types';

const TextBarFill = '#ced4da';

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
                fill={TextBarFill}
                stroke="none"
            />
        );
    }

    return <rect x={x} y={y} width={width} height={height} {...common} />;
}

export function WhiteboardTemplatePreview({
    preview,
}: {
    preview: WhiteboardPreview;
}) {
    const strokeWidth = Math.max(preview.width, preview.height) / 200;

    return (
        <div className="rounded-md border border-black/10 bg-white p-2">
            <svg
                viewBox={`0 0 ${preview.width || 1} ${preview.height || 1}`}
                preserveAspectRatio="xMidYMid meet"
                className="h-24 w-full"
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
        </div>
    );
}
