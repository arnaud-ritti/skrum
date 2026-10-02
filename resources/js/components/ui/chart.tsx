import {
    createContext,
    useContext,
    useId,
    useMemo,
    useState,
    useSyncExternalStore,
} from 'react';
import type {
    ComponentProps,
    CSSProperties,
    KeyboardEvent,
    ReactNode,
} from 'react';
import * as RechartsPrimitive from 'recharts';
import { EmptyState } from '@/components/skrum/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type ChartConfig = Record<
    string,
    {
        label?: ReactNode;
        color?: string;
    }
>;

type ChartContextValue = { config: ChartConfig };

const PendingSuffix = '__pending';

const ChartContext = createContext<ChartContextValue | null>(null);

function useChart(): ChartContextValue {
    const context = useContext(ChartContext);

    if (!context) {
        throw new Error('useChart must be used within a <ChartContainer />');
    }

    return context;
}

const subscribeToMotionPreference = (onChange: () => void): (() => void) => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');

    query.addEventListener('change', onChange);

    return () => query.removeEventListener('change', onChange);
};

const prefersReducedMotion = (): boolean =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useReducedMotion(): boolean {
    return useSyncExternalStore(
        subscribeToMotionPreference,
        prefersReducedMotion,
        () => false,
    );
}

function ChartContainer({
    id,
    className,
    children,
    config,
    initialDimension,
    style,
    ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
    config: ChartConfig;
    children: ComponentProps<
        typeof RechartsPrimitive.ResponsiveContainer
    >['children'];
    initialDimension?: { width: number; height: number };
}) {
    const uniqueId = useId();
    const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

    const colorVariables = Object.fromEntries(
        Object.entries(config)
            .filter(([, item]) => item.color)
            .map(([key, item]) => [`--color-${key}`, item.color]),
    ) as CSSProperties;

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-slot="chart"
                data-chart={chartId}
                style={{ ...colorVariables, ...style }}
                className={cn(
                    "flex aspect-video justify-center font-sans text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-axis-tick_text]:text-overline [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-curve.recharts-tooltip-cursor]:stroke-muted-foreground [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
                    // Recharts sizes these in pixels one render late: they must not overflow while the container shrinks.
                    '[&_.recharts-legend-wrapper]:inset-x-1! [&_.recharts-legend-wrapper]:w-auto! [&_.recharts-responsive-container>div]:w-full! [&_.recharts-surface]:max-w-full [&_.recharts-wrapper]:max-w-full',
                    className,
                )}
                {...props}
            >
                <RechartsPrimitive.ResponsiveContainer
                    initialDimension={initialDimension}
                >
                    {children}
                </RechartsPrimitive.ResponsiveContainer>
            </div>
        </ChartContext.Provider>
    );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipPayloadItem = {
    dataKey?: string | number;
    name?: string | number;
    value?: unknown;
    color?: string;
    payload?: Record<string, unknown>;
};

function seriesKeyOf(item: TooltipPayloadItem): string {
    return String(item.dataKey ?? item.name ?? 'value').replace(
        new RegExp(`${PendingSuffix}$`),
        '',
    );
}

function ChartTooltipContent({
    active,
    payload,
    className,
    indicator = 'dot',
    label,
    labelFormatter,
    unit,
}: {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    className?: string;
    indicator?: 'dot' | 'line';
    label?: ReactNode;
    labelFormatter?: (label: ReactNode) => ReactNode;
    unit?: string;
}) {
    const { config } = useChart();

    const items = useMemo(() => {
        const seen = new Set<string>();

        return (payload ?? []).filter((item) => {
            if (item.value === null || item.value === undefined) {
                return false;
            }

            const key = seriesKeyOf(item);

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);

            return true;
        });
    }, [payload]);

    if (!active || items.length === 0) {
        return null;
    }

    const heading = labelFormatter ? labelFormatter(label) : label;

    return (
        <div
            data-slot="chart-tooltip"
            className={cn(
                'grid min-w-32 items-start gap-1.5 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-popover',
                className,
            )}
        >
            {heading ? <div className="font-medium">{heading}</div> : null}
            <div className="grid gap-1.5">
                {items.map((item) => {
                    const key = seriesKeyOf(item);
                    const color = config[key]?.color ?? item.color;

                    return (
                        <div
                            key={key}
                            className="flex items-center gap-2"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'shrink-0 rounded-xs',
                                    indicator === 'dot'
                                        ? 'size-2.5'
                                        : 'h-2.5 w-1',
                                )}
                                style={{ backgroundColor: color }}
                            />
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                {config[key]?.label ?? item.name}
                            </span>
                            <span className="font-mono font-medium text-foreground tabular-nums">
                                {String(item.value)}
                                {unit ? ` ${unit}` : ''}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
    className,
    payload,
}: {
    className?: string;
    payload?: Array<{
        dataKey?: unknown;
        value?: unknown;
        color?: string;
    }>;
}) {
    const { config } = useChart();

    const items = (payload ?? []).filter(
        (item) => !String(item.dataKey).endsWith(PendingSuffix),
    );

    if (items.length === 0) {
        return null;
    }

    return (
        <ul
            data-slot="chart-legend"
            className={cn(
                'flex flex-wrap items-center justify-end gap-x-4 gap-y-1',
                className,
            )}
        >
            {items.map((item) => {
                const key = String(item.dataKey ?? item.value);

                return (
                    <li
                        key={key}
                        className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                    >
                        <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-xs"
                            style={{
                                backgroundColor: config[key]?.color ?? item.color,
                            }}
                        />
                        <span className="truncate">
                            {config[key]?.label ?? String(item.value)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export type TeamChartProps<T extends Record<string, unknown>> = {
    title: string;
    description: string;
    data: T[];
    config: ChartConfig;
    kind: 'bar' | 'line';
    xKey: keyof T & string;
    unit?: string;
    loading?: boolean;
    currentPeriod?: T[keyof T];
    emptyTitle?: string;
    emptyDescription?: string;
    initialDimension?: { width: number; height: number };
    animated?: boolean;
    className?: string;
};

function ChartTable<T extends Record<string, unknown>>({
    caption,
    data,
    config,
    xKey,
    unit,
}: {
    caption: string;
    data: T[];
    config: ChartConfig;
    xKey: keyof T & string;
    unit?: string;
}) {
    const seriesKeys = Object.keys(config);

    return (
        <div className="max-h-64 overflow-auto rounded-md border border-border">
            <table
                data-slot="chart-table"
                className="w-full text-left text-sm"
            >
                <caption className="sr-only">{caption}</caption>
                <thead className="bg-muted text-xs text-muted-foreground">
                    <tr>
                        <th scope="col" className="px-3 py-1.5 font-medium">
                            {String(xKey)}
                        </th>
                        {seriesKeys.map((key) => (
                            <th
                                key={key}
                                scope="col"
                                className="px-3 py-1.5 text-right font-medium"
                            >
                                {config[key].label ?? key}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr
                            key={`${String(row[xKey])}-${index}`}
                            className="border-t border-border"
                        >
                            <th
                                scope="row"
                                className="px-3 py-1.5 font-medium"
                            >
                                {String(row[xKey])}
                            </th>
                            {seriesKeys.map((key) => (
                                <td
                                    key={key}
                                    className="px-3 py-1.5 text-right tabular-nums"
                                >
                                    {row[key] === null || row[key] === undefined
                                        ? '-'
                                        : `${String(row[key])}${unit ? ` ${unit}` : ''}`}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TeamChart<T extends Record<string, unknown>>({
    title,
    description,
    data,
    config,
    kind,
    xKey,
    unit,
    loading = false,
    currentPeriod,
    emptyTitle,
    emptyDescription,
    initialDimension,
    animated = true,
    className,
}: TeamChartProps<T>) {
    const { t } = useTrans();
    const reducedMotion = useReducedMotion() || !animated;
    const [tableOpen, setTableOpen] = useState(false);
    const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
    const tableId = useId();
    const seriesKeys = Object.keys(config);

    const hasCurrent =
        currentPeriod !== undefined &&
        data.some((row) => row[xKey] === currentPeriod);

    const chartData = useMemo(() => {
        if (kind !== 'line' || !hasCurrent) {
            return data;
        }

        const currentIndex = data.findIndex(
            (row) => row[xKey] === currentPeriod,
        );

        return data.map((row, index) => {
            const next: Record<string, unknown> = { ...row };

            for (const key of seriesKeys) {
                next[`${key}${PendingSuffix}`] =
                    index === currentIndex || index === currentIndex - 1
                        ? row[key]
                        : null;

                if (index === currentIndex) {
                    next[key] = null;
                }
            }

            return next;
        });
    }, [data, kind, hasCurrent, currentPeriod, xKey, seriesKeys.join('|')]);

    const summary = t(':title. :description', { title, description });

    const readout =
        keyboardIndex === null || !data[keyboardIndex]
            ? ''
            : `${String(data[keyboardIndex][xKey])}: ${seriesKeys
                  .map(
                      (key) =>
                          `${String(config[key].label ?? key)} ${String(data[keyboardIndex][key] ?? '-')}${unit ? ` ${unit}` : ''}`,
                  )
                  .join(', ')}`;

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (data.length === 0) {
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            setKeyboardIndex((index) =>
                index === null ? 0 : Math.min(index + 1, data.length - 1),
            );
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setKeyboardIndex((index) =>
                index === null ? data.length - 1 : Math.max(index - 1, 0),
            );
        }

        if (event.key === 'Escape') {
            setKeyboardIndex(null);
        }
    };

    const tooltipProps =
        keyboardIndex === null
            ? {}
            : { active: true, defaultIndex: keyboardIndex };

    const shared = (
        <>
            <RechartsPrimitive.CartesianGrid vertical={false} />
            <RechartsPrimitive.XAxis
                dataKey={xKey as string}
                tickLine={false}
                axisLine={false}
            />
            <RechartsPrimitive.YAxis
                width={32}
                tickLine={false}
                axisLine={false}
            />
            <ChartTooltip
                key={keyboardIndex ?? 'pointer'}
                {...tooltipProps}
                cursor={
                    kind === 'line'
                        ? { strokeDasharray: '3 3' }
                        : { fillOpacity: 1 }
                }
                content={<ChartTooltipContent unit={unit} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
        </>
    );

    const body = loading ? (
        <Skeleton
            data-slot="chart-loading"
            role="status"
            aria-label={t('Loading chart')}
            className="h-51 w-full"
        />
    ) : data.length === 0 ? (
        <EmptyState
            module="actions"
            title={emptyTitle ?? t('Not enough sprints yet')}
            description={
                emptyDescription ??
                t('The chart appears once a few periods are recorded.')
            }
            illustration={false}
            headingLevel="h3"
        />
    ) : (
        <>
            <div
                role="group"
                aria-label={summary}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onBlur={() => setKeyboardIndex(null)}
                onMouseEnter={() => setKeyboardIndex(null)}
                className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                <ChartContainer
                    config={config}
                    className="aspect-auto h-51 w-full"
                    initialDimension={initialDimension}
                >
                    {kind === 'bar' ? (
                        <RechartsPrimitive.BarChart
                            data={chartData}
                            barGap={2}
                            barCategoryGap="20%"
                            accessibilityLayer={false}
                        >
                            {shared}
                            {seriesKeys.map((key) => (
                                <RechartsPrimitive.Bar
                                    key={key}
                                    dataKey={key}
                                    fill={`var(--color-${key})`}
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={!reducedMotion}
                                >
                                    {hasCurrent
                                        ? data.map((row, index) => (
                                              <RechartsPrimitive.Cell
                                                  key={`${key}-${index}`}
                                                  fillOpacity={
                                                      row[xKey] ===
                                                      currentPeriod
                                                          ? 0.45
                                                          : 1
                                                  }
                                              />
                                          ))
                                        : null}
                                </RechartsPrimitive.Bar>
                            ))}
                        </RechartsPrimitive.BarChart>
                    ) : (
                        <RechartsPrimitive.LineChart
                            data={chartData}
                            accessibilityLayer={false}
                        >
                            {shared}
                            {seriesKeys.map((key) => (
                                <RechartsPrimitive.Line
                                    key={key}
                                    type="linear"
                                    dataKey={key}
                                    stroke={`var(--color-${key})`}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{
                                        r: 4.5,
                                        strokeWidth: 2,
                                        stroke: 'var(--card)',
                                    }}
                                    isAnimationActive={!reducedMotion}
                                />
                            ))}
                            {hasCurrent
                                ? seriesKeys.map((key) => (
                                      <RechartsPrimitive.Line
                                          key={`${key}${PendingSuffix}`}
                                          type="linear"
                                          dataKey={`${key}${PendingSuffix}`}
                                          stroke={`var(--color-${key})`}
                                          strokeWidth={2}
                                          strokeDasharray="4 4"
                                          dot={false}
                                          activeDot={{
                                              r: 4.5,
                                              strokeWidth: 2,
                                              stroke: 'var(--card)',
                                          }}
                                          legendType="none"
                                          isAnimationActive={!reducedMotion}
                                      />
                                  ))
                                : null}
                        </RechartsPrimitive.LineChart>
                    )}
                </ChartContainer>
            </div>
            <p role="status" className="sr-only">
                {readout}
            </p>
            <div className="flex flex-col gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    aria-expanded={tableOpen}
                    aria-controls={tableId}
                    onClick={() => setTableOpen((open) => !open)}
                >
                    <span className="truncate">
                        {tableOpen ? t('Hide the data') : t('View the data')}
                    </span>
                </Button>
                <div id={tableId}>
                    {tableOpen ? (
                        <ChartTable
                            caption={summary}
                            data={data}
                            config={config}
                            xKey={xKey}
                            unit={unit}
                        />
                    ) : null}
                </div>
            </div>
        </>
    );

    return (
        <section
            data-slot="team-chart"
            aria-label={title}
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card',
                className,
            )}
        >
            <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">
                        {title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
            </header>
            {body}
        </section>
    );
}

export {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    ChartTable,
    TeamChart,
};
