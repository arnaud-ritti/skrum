import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableBulkBar,
    TableCell,
    TableCheckbox,
    TableEmpty,
    TableHead,
    TableHeader,
    TableLoading,
    TableRow,
    TableSelectAll,
    TableSortHead,
} from '@/components/ui/table';
import type { SortDirection } from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

interface Row {
    id: string;
    title: string;
    owner: string;
    due: string;
    done?: boolean;
    late?: boolean;
}

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function DataTable({
    rows,
    sort = null,
    selected = [],
    state,
    onSort = () => {},
    onToggle = () => {},
    onToggleAll = () => {},
}: {
    rows: Row[];
    sort?: SortDirection | null;
    selected?: string[];
    state?: 'loading';
    onSort?: () => void;
    onToggle?: (id: string) => void;
    onToggleAll?: (checked: boolean) => void;
}) {
    const { t } = useTrans();
    const all =
        rows.length > 0 && selected.length === rows.length
            ? true
            : selected.length > 0
              ? 'indeterminate'
              : false;

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>
                        <TableSelectAll
                            checked={all}
                            onCheckedChange={onToggleAll}
                        />
                    </TableHead>
                    <TableHead className="w-full min-w-48">
                        {t('Action')}
                    </TableHead>
                    <TableHead>{t('Owner')}</TableHead>
                    <TableSortHead direction={sort} onSort={onSort}>
                        {t('Due date')}
                    </TableSortHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {state === 'loading' ? <TableLoading columns={4} /> : null}
                {state !== 'loading' && rows.length === 0 ? (
                    <TableEmpty colSpan={4}>{t('No actions yet')}</TableEmpty>
                ) : null}
                {state !== 'loading'
                    ? rows.map((row) => (
                          <TableRow
                              key={row.id}
                              selected={selected.includes(row.id)}
                              done={row.done}
                              late={row.late}
                          >
                              <TableCell>
                                  <TableCheckbox
                                      checked={selected.includes(row.id)}
                                      onCheckedChange={() => onToggle(row.id)}
                                      aria-label={t('Select :title', {
                                          title: row.title,
                                      })}
                                  />
                              </TableCell>
                              <TableCell className="max-w-0 min-w-48 font-semibold">
                                  <span
                                      className={
                                          row.done
                                              ? 'block truncate line-through'
                                              : 'block truncate'
                                      }
                                  >
                                      {row.title}
                                  </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                  {row.owner}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                  {row.late ? (
                                      <Badge variant="destructive">
                                          {row.due}
                                      </Badge>
                                  ) : (
                                      row.due
                                  )}
                              </TableCell>
                          </TableRow>
                      ))
                    : null}
            </TableBody>
        </Table>
    );
}

function makeRows(count: number, t: (key: string) => string): Row[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `row-${index}`,
        title: `${t('Isolate E2E data')} ${index + 1}`,
        owner: index % 5 === 0 ? t('Guest') : 'Camille',
        due: `${(index % 28) + 1}/10`,
        done: index % 7 === 3,
        late: index % 9 === 4,
    }));
}

function Interactive() {
    const { t } = useTrans();
    const rows = makeRows(4, t);
    const [sort, setSort] = useState<SortDirection | null>('asc');
    const [selected, setSelected] = useState<string[]>(['row-1']);

    return (
        <Card className="overflow-hidden">
            {selected.length > 0 ? (
                <TableBulkBar count={selected.length} className="border-b">
                    <Button size="sm" variant="outline">
                        <span className="truncate">{t('Mark as done')}</span>
                    </Button>
                </TableBulkBar>
            ) : null}
            <DataTable
                rows={sort === 'desc' ? [...rows].reverse() : rows}
                sort={sort}
                selected={selected}
                onSort={() => setSort(sort === 'asc' ? 'desc' : 'asc')}
                onToggle={(id) =>
                    setSelected((current) =>
                        current.includes(id)
                            ? current.filter((value) => value !== id)
                            : [...current, id],
                    )
                }
                onToggleAll={(checked) =>
                    setSelected(checked ? rows.map((row) => row.id) : [])
                }
            />
        </Card>
    );
}

export default function TableSection() {
    const { t } = useTrans();
    const some = makeRows(4, t);
    const long: Row[] = [
        {
            id: 'long',
            title: 'Mettre en place une procédure documentée de rotation des astreintes avec revue mensuelle et escalade automatique',
            owner: 'Marie-Charlotte de la Fontaine-Beauregard',
            due: '30/10',
            late: true,
        },
    ];

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Interactive: sortable header, selection, mixed select-all, bulk bar',
                )}
            >
                <Interactive />
            </Example>
            <Example
                label={t('Sorted descending, selected, done, late and guest')}
            >
                <Card className="overflow-hidden">
                    <DataTable rows={some} sort="desc" selected={['row-1']} />
                </Card>
            </Example>
            <Example label={t('Select all checked')}>
                <Card className="overflow-hidden">
                    <DataTable
                        rows={some.slice(0, 2)}
                        selected={['row-0', 'row-1']}
                    />
                </Card>
            </Example>
            <Example label={t('Empty')}>
                <Card className="overflow-hidden">
                    <DataTable rows={[]} />
                </Card>
            </Example>
            <Example label={t('Loading')}>
                <Card className="overflow-hidden">
                    <DataTable rows={[]} state="loading" />
                </Card>
            </Example>
            <Example label={t('One row')}>
                <Card className="overflow-hidden">
                    <DataTable rows={some.slice(0, 1)} />
                </Card>
            </Example>
            <Example label={t('Long French labels and a 40-character name')}>
                <Card className="overflow-hidden">
                    <DataTable rows={long} />
                </Card>
            </Example>
            <Example label={t('200 rows in a fixed-height scroller')}>
                <Card className="max-h-80 overflow-y-auto">
                    <DataTable rows={makeRows(200, t)} />
                </Card>
            </Example>
        </div>
    );
}
