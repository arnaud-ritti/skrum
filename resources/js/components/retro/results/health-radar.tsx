import { useTrans } from '@/hooks/use-trans';
import type { HealthStatementResult } from '@/lib/retro/types';

const ViewBoxSize = 320;
const Center = ViewBoxSize / 2;
const Radius = 100;
const LabelRadius = 118;
const Rings = [2.5, 5, 7.5, 10];

type Point = { x: number; y: number };

export function formatScore(score: number): string {
    return score.toFixed(1);
}

function angleOf(index: number, total: number): number {
    return -Math.PI / 2 + (2 * Math.PI * index) / total;
}

function pointAt(index: number, total: number, distance: number): Point {
    const angle = angleOf(index, total);

    return {
        x: Center + distance * Math.cos(angle),
        y: Center + distance * Math.sin(angle),
    };
}

function scorePoint(index: number, total: number, score: number): Point {
    return pointAt(index, total, (Radius * score) / 10);
}

function textAnchor(index: number, total: number): 'start' | 'middle' | 'end' {
    const cosine = Math.cos(angleOf(index, total));

    if (cosine > 0.3) {
        return 'start';
    }

    if (cosine < -0.3) {
        return 'end';
    }

    return 'middle';
}

function toPoints(points: Point[]): string {
    return points.map(({ x, y }) => `${x},${y}`).join(' ');
}

export function HealthRadar({
    statements,
}: {
    statements: HealthStatementResult[];
}) {
    const { t } = useTrans();
    const total = statements.length;
    const scored = statements.map((statement, index) =>
        statement.average === null
            ? null
            : scorePoint(index, total, statement.average),
    );
    const answered = scored.filter((point): point is Point => point !== null);
    const isComplete = answered.length === total;
    const segments = scored.flatMap((point, index) => {
        const next = scored[(index + 1) % total];

        return point && next ? [{ from: point, to: next, index }] : [];
    });

    return (
        <svg
            viewBox={`0 0 ${ViewBoxSize} ${ViewBoxSize}`}
            role="img"
            aria-label={t('Team health radar')}
            className="w-full max-w-80 overflow-visible"
        >
            {Rings.map((ring) => (
                <polygon
                    key={ring}
                    points={toPoints(
                        statements.map((_, index) =>
                            scorePoint(index, total, ring),
                        ),
                    )}
                    className="fill-none stroke-border"
                />
            ))}
            {statements.map((statement, index) => {
                const end = scorePoint(index, total, 10);

                return (
                    <line
                        key={statement.key}
                        x1={Center}
                        y1={Center}
                        x2={end.x}
                        y2={end.y}
                        className="stroke-border"
                    />
                );
            })}
            {isComplete ? (
                <polygon
                    points={toPoints(answered)}
                    strokeWidth={2}
                    className="fill-primary/20 stroke-primary"
                />
            ) : (
                segments.map(({ from, to, index }) => (
                    <line
                        key={index}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        strokeWidth={2}
                        className="stroke-primary"
                    />
                ))
            )}
            {answered.map(({ x, y }) => (
                <circle
                    key={`${x}-${y}`}
                    cx={x}
                    cy={y}
                    r={3.5}
                    className="fill-primary"
                />
            ))}
            {statements.map((statement, index) => {
                const label = pointAt(index, total, LabelRadius);

                return (
                    <text
                        key={statement.key}
                        x={label.x}
                        y={label.y}
                        fontSize={11}
                        textAnchor={textAnchor(index, total)}
                        dominantBaseline="middle"
                        className="fill-foreground"
                    >
                        {statement.label}
                        {statement.average === null && (
                            <tspan
                                x={label.x}
                                dy="1.2em"
                                className="fill-muted-foreground"
                            >
                                {t('No answers')}
                            </tspan>
                        )}
                    </text>
                );
            })}
        </svg>
    );
}
