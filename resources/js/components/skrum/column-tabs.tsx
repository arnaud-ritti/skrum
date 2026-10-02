import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export type ColumnTab = {
    id: string;
    label: string;
    /** Left out, the tab is neutral: a tab that is not a column. */
    color?: ColumnColor;
    count?: number;
    icon?: LucideIcon;
};

export type ColumnTabsProps = {
    tabs: ColumnTab[];
    value: string;
    onValueChange: (id: string) => void;
    /** Id of the panel the selected tab shows. */
    panelId: string;
    'aria-label': string;
    className?: string;
};

/** Id of a tab, for the `aria-labelledby` of its panel. */
export function columnTabId(panelId: string, id: string): string {
    return `${panelId}-tab-${id}`;
}

/**
 * The columns of a board on a phone: one tab per column, the selected one in
 * the colour of its column, and a line of dots that says where one is.
 */
export function ColumnTabs({
    tabs,
    value,
    onValueChange,
    panelId,
    'aria-label': ariaLabel,
    className,
}: ColumnTabsProps) {
    const { t } = useTrans();
    const tabRefs = useRef(new Map<string, HTMLButtonElement>());
    const selected = tabs.find((tab) => tab.id === value);

    useEffect(() => {
        const node = tabRefs.current.get(value);

        if (node && typeof node.scrollIntoView === 'function') {
            node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }, [value]);

    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const targets: Record<string, number> = {
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            Home: 0,
            End: tabs.length - 1,
        };
        const target = tabs[targets[event.key]];

        if (targets[event.key] === undefined) {
            return;
        }

        event.preventDefault();

        if (!target) {
            return;
        }

        onValueChange(target.id);
        tabRefs.current.get(target.id)?.focus();
    };

    return (
        <div
            data-slot="column-tabs"
            className={cn('flex min-w-0 flex-col gap-2', className)}
        >
            <div
                role="tablist"
                aria-label={ariaLabel}
                className="relative flex min-w-0 [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-1"
            >
                {tabs.map((tab, index) => {
                    const isSelected = tab.id === value;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            ref={(node) => {
                                if (node) {
                                    tabRefs.current.set(tab.id, node);

                                    return;
                                }

                                tabRefs.current.delete(tab.id);
                            }}
                            type="button"
                            role="tab"
                            id={columnTabId(panelId, tab.id)}
                            aria-selected={isSelected}
                            aria-controls={isSelected ? panelId : undefined}
                            tabIndex={isSelected ? 0 : -1}
                            data-slot="column-tab"
                            data-color={tab.color}
                            onClick={() => onValueChange(tab.id)}
                            onKeyDown={(event) => move(event, index)}
                            className={cn(
                                tab.color && columnColorClass(tab.color),
                                'inline-flex h-11 max-w-56 shrink-0 items-center gap-2 rounded-lg border border-transparent px-3 text-sm font-semibold text-muted-foreground outline-ring transition-colors duration-140 ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
                                isSelected &&
                                    (tab.color
                                        ? 'border-(--col-border) bg-(--col) text-foreground'
                                        : 'border-border bg-muted text-foreground'),
                            )}
                        >
                            {tab.color && (
                                <span
                                    aria-hidden
                                    className="size-2.5 shrink-0 rounded-full bg-(--col-border)"
                                />
                            )}
                            {Icon && (
                                <Icon className="size-4 shrink-0" aria-hidden />
                            )}
                            <span className="truncate">{tab.label}</span>
                            {tab.count !== undefined && (
                                <span
                                    data-slot="column-tab-count"
                                    className={cn(
                                        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                                        tab.color
                                            ? 'bg-(--col-border) text-(--col-text)'
                                            : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    <span aria-hidden>{tab.count}</span>
                                    <span className="sr-only">
                                        {tab.count === 1
                                            ? t(':count card', {
                                                  count: tab.count,
                                              })
                                            : t(':count cards', {
                                                  count: tab.count,
                                              })}
                                    </span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            {tabs.length > 1 && (
                <div
                    aria-hidden
                    data-slot="column-tabs-dots"
                    className={cn(
                        selected?.color && columnColorClass(selected.color),
                        'flex justify-center gap-1.5',
                    )}
                >
                    {tabs.map((tab) => (
                        <span
                            key={tab.id}
                            data-current={tab.id === value || undefined}
                            className={cn(
                                'h-1.5 rounded-full transition-[width] duration-140 ease-standard motion-reduce:transition-none',
                                tab.id === value
                                    ? selected?.color
                                        ? 'w-4.5 bg-(--col-border)'
                                        : 'w-4.5 bg-muted-foreground'
                                    : 'w-1.5 bg-border',
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
