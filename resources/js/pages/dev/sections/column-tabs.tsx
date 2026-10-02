import { ListChecks, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { ColumnTabs, columnTabId } from '@/components/skrum/column-tabs';
import type { ColumnTab } from '@/components/skrum/column-tabs';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="px-4 text-sm font-medium text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

function Tabs({
    id,
    tabs,
    initial,
}: {
    id: string;
    tabs: ColumnTab[];
    initial: string;
}) {
    const { t } = useTrans();
    const [value, setValue] = useState(initial);
    const selected = tabs.find((tab) => tab.id === value);

    return (
        <div className="flex w-full max-w-sm min-w-0 flex-col rounded-xl border bg-background py-2">
            <ColumnTabs
                aria-label={t('Columns')}
                tabs={tabs}
                value={value}
                panelId={id}
                onValueChange={setValue}
            />
            <p
                id={id}
                role="tabpanel"
                aria-labelledby={columnTabId(id, value)}
                className="px-4 pt-3 text-sm text-muted-foreground"
            >
                {selected?.label}
            </p>
        </div>
    );
}

export default function ColumnTabsSection() {
    const { t } = useTrans();
    const columns: ColumnTab[] = [
        { id: 'well', label: t('What went well'), color: 'moss', count: 6 },
        { id: 'improve', label: t('To improve'), color: 'coral', count: 4 },
        { id: 'ideas', label: t('Ideas'), color: 'sky', count: 2 },
        { id: 'thanks', label: t('Thanks'), color: 'plum', count: 0 },
    ];

    return (
        <div className="flex flex-col gap-8 py-4 md:p-6">
            <Example label={t('One tab per column, the second one selected')}>
                <Tabs id="bench-tabs" tabs={columns} initial="improve" />
            </Example>
            <Example label={t('With the tabs that are not a column')}>
                <Tabs
                    id="bench-tabs-extra"
                    tabs={[
                        {
                            id: 'surveys',
                            label: t('Surveys'),
                            icon: ListChecks,
                        },
                        ...columns.slice(0, 2),
                        { id: 'add', label: t('Add column'), icon: Plus },
                    ]}
                    initial="surveys"
                />
            </Example>
            <Example label={t('A single column, without the dots')}>
                <Tabs
                    id="bench-tabs-one"
                    tabs={columns.slice(0, 1)}
                    initial="well"
                />
            </Example>
        </div>
    );
}
