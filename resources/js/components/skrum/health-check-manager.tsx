import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { Announcements, DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import {
    EllipsisIcon,
    GripVerticalIcon,
    InfoIcon,
    MoveVerticalIcon,
    PencilIcon,
    PlusIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardMenu } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export interface HealthStatement {
    id: string;
    label: string;
    text: string;
    builtIn: boolean;
    enabled: boolean;
    position: number;
}

export interface HealthStatementDraft {
    label: string;
    text: string;
}

export interface HealthStatementsManagerProps {
    statements: HealthStatement[];
    canManage: boolean;
    onToggle: (id: string, enabled: boolean) => void;
    onReorder: (orderedIds: string[]) => void;
    onAdd: (statement: HealthStatementDraft) => void;
    onEdit?: (id: string, statement: HealthStatementDraft) => void;
    onDelete?: (id: string) => void;
    className?: string;
}

export const healthStatementLabelMax = 24;
export const healthStatementTextMax = 120;

export function reorderedIds(
    ids: string[],
    activeId: string,
    overId: string,
): string[] {
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);

    if (from === -1 || to === -1 || from === to) {
        return ids;
    }

    return arrayMove(ids, from, to);
}

function isValidDraft(draft: HealthStatementDraft): boolean {
    return draft.label.trim() !== '' && draft.text.trim() !== '';
}

function StatementFields({
    initial,
    submitLabel,
    submitIcon: SubmitIcon,
    onSubmit,
    onCancel,
    labelPlaceholder,
    textPlaceholder,
    className,
}: {
    initial: HealthStatementDraft;
    submitLabel: string;
    submitIcon?: typeof PlusIcon;
    onSubmit: (draft: HealthStatementDraft) => void;
    onCancel?: () => void;
    labelPlaceholder: string;
    textPlaceholder: string;
    className?: string;
}) {
    const { t } = useTrans();
    const [draft, setDraft] = useState(initial);
    const valid = isValidDraft(draft);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!valid) {
            return;
        }

        onSubmit({ label: draft.label.trim(), text: draft.text.trim() });
        setDraft(initial);
    }

    return (
        <form
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && onCancel) {
                    event.stopPropagation();
                    onCancel();
                }
            }}
            className={cn(
                'grid gap-2 @lg/card:grid-cols-[auto_minmax(0,1fr)_auto]',
                className,
            )}
        >
            <Input
                value={draft.label}
                maxLength={healthStatementLabelMax}
                placeholder={labelPlaceholder}
                aria-label={labelPlaceholder}
                onChange={(event) =>
                    setDraft({ ...draft, label: event.target.value })
                }
                className="@lg/card:w-36"
            />
            <Input
                value={draft.text}
                maxLength={healthStatementTextMax}
                placeholder={textPlaceholder}
                aria-label={textPlaceholder}
                onChange={(event) =>
                    setDraft({ ...draft, text: event.target.value })
                }
            />
            <div className="flex gap-2">
                <Button type="submit" variant="secondary" disabled={!valid}>
                    {SubmitIcon ? <SubmitIcon aria-hidden /> : null}
                    <span className="truncate">{submitLabel}</span>
                </Button>
                {onCancel ? (
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                ) : null}
            </div>
        </form>
    );
}

function StatementSwitch({
    checked,
    label,
    disabled,
    onCheckedChange,
}: {
    checked: boolean;
    label: string;
    disabled: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            checked={checked}
            disabled={disabled}
            aria-label={label}
            onCheckedChange={onCheckedChange}
            className="peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors duration-140 ease-standard outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary motion-reduce:transition-none"
        >
            <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-card shadow-xs transition-transform duration-140 ease-standard data-[state=checked]:translate-x-4.5 motion-reduce:transition-none" />
        </SwitchPrimitive.Root>
    );
}

function StatementRow({
    statement,
    canManage,
    editing,
    onToggle,
    onEditRequest,
    onEditCancel,
    onEdit,
    onDelete,
}: {
    statement: HealthStatement;
    canManage: boolean;
    editing: boolean;
    onToggle: (id: string, enabled: boolean) => void;
    onEditRequest: () => void;
    onEditCancel: () => void;
    onEdit?: (id: string, draft: HealthStatementDraft) => void;
    onDelete?: (id: string) => void;
}) {
    const { t } = useTrans();
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: statement.id, disabled: !canManage });
    const muted = !statement.enabled;
    const entries = [
        ...(onEdit
            ? [
                  {
                      type: 'item' as const,
                      label: t('Edit'),
                      icon: PencilIcon,
                      onSelect: onEditRequest,
                  },
              ]
            : []),
        ...(onDelete
            ? [
                  {
                      type: 'item' as const,
                      label: t('Delete'),
                      tone: 'danger' as const,
                      onSelect: () => setConfirmingDelete(true),
                  },
              ]
            : []),
    ];
    const hasMenu = canManage && !statement.builtIn && entries.length > 0;

    return (
        <li
            ref={setNodeRef}
            data-slot="health-statement"
            data-statement-id={statement.id}
            data-enabled={statement.enabled}
            data-dragging={isDragging || undefined}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                'relative flex items-start gap-2 bg-card px-3 py-1 @max-card-narrow/card:px-2',
                isDragging &&
                    'z-10 rounded-lg shadow-drag ring-2 ring-ring motion-safe:-rotate-1',
            )}
        >
            {canManage ? (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    aria-label={t('Reorder: :label', {
                        label: statement.label,
                    })}
                    className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                >
                    <GripVerticalIcon className="size-4" aria-hidden />
                </button>
            ) : null}
            {editing && onEdit ? (
                <div className="min-w-0 flex-1 py-2">
                    <StatementFields
                        initial={{
                            label: statement.label,
                            text: statement.text,
                        }}
                        submitLabel={t('Save')}
                        onSubmit={(draft) => {
                            onEdit(statement.id, draft);
                            onEditCancel();
                        }}
                        onCancel={onEditCancel}
                        labelPlaceholder={t('Short label')}
                        textPlaceholder={t('Statement')}
                    />
                </div>
            ) : (
                <>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                                className={cn(
                                    'min-w-0 truncate text-sm font-bold',
                                    muted && 'text-muted-foreground',
                                )}
                            >
                                {statement.label}
                            </span>
                            {statement.builtIn ? (
                                <Badge variant="outline">{t('Built-in')}</Badge>
                            ) : (
                                <Badge variant="soft">{t('Custom')}</Badge>
                            )}
                            {muted ? (
                                <Badge variant="muted">{t('Disabled')}</Badge>
                            ) : null}
                        </div>
                        <p className="text-body-sm text-muted-foreground">
                            {statement.text}
                        </p>
                    </div>
                    <div className="flex h-11 shrink-0 items-center gap-1">
                        <StatementSwitch
                            checked={statement.enabled}
                            label={statement.label}
                            disabled={!canManage}
                            onCheckedChange={(checked) =>
                                onToggle(statement.id, checked)
                            }
                        />
                        {hasMenu ? (
                            <CardMenu
                                label={t('Actions: :label', {
                                    label: statement.label,
                                })}
                                entries={entries}
                                trigger={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={t('Actions: :label', {
                                            label: statement.label,
                                        })}
                                    >
                                        <EllipsisIcon aria-hidden />
                                    </Button>
                                }
                            />
                        ) : null}
                    </div>
                </>
            )}
            {onDelete ? (
                <ConfirmDialog
                    open={confirmingDelete}
                    onOpenChange={setConfirmingDelete}
                    title={t('Delete this statement?')}
                    description={t(
                        '":label" will no longer be asked in future retros. Past results are kept.',
                        { label: statement.label },
                    )}
                    confirmLabel={t('Delete')}
                    tone="destructive"
                    onConfirm={async () => onDelete(statement.id)}
                />
            ) : null}
        </li>
    );
}

export function HealthStatementsManager({
    statements,
    canManage,
    onToggle,
    onReorder,
    onAdd,
    onEdit,
    onDelete,
    className,
}: HealthStatementsManagerProps) {
    const { t } = useTrans();
    const [pending, setPending] = useState<{
        source: HealthStatement[];
        ids: string[];
    } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [moving, setMoving] = useState<string | null>(null);
    const sorted = [...statements].sort((a, b) => a.position - b.position);
    const ids =
        pending && pending.source === statements
            ? pending.ids
            : sorted.map((statement) => statement.id);
    const byId = new Map(statements.map((s) => [s.id, s]));
    const ordered = ids
        .map((id) => byId.get(id))
        .filter((s): s is HealthStatement => s !== undefined);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    function labelOf(id: string | number): string {
        return byId.get(String(id))?.label ?? '';
    }

    function positionOf(id: string | number): number {
        return ids.indexOf(String(id)) + 1;
    }

    function movingText(id: string | number, position: number): string {
        return t('Moving: :label. Position :position of :total.', {
            label: labelOf(id),
            position,
            total: ids.length,
        });
    }

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            t('Picked up :label. Position :position of :total.', {
                label: labelOf(active.id),
                position: positionOf(active.id),
                total: ids.length,
            }),
        onDragOver: ({ active, over }) =>
            over ? movingText(active.id, positionOf(over.id)) : undefined,
        onDragEnd: ({ active, over }) =>
            t('Dropped :label. Position :position of :total.', {
                label: labelOf(active.id),
                position: positionOf(over?.id ?? active.id),
                total: ids.length,
            }),
        onDragCancel: ({ active }) =>
            t('Reordering cancelled. :label is back at position :position.', {
                label: labelOf(active.id),
                position: positionOf(active.id),
            }),
    };

    function handleDragEnd({ active, over }: DragEndEvent) {
        setMoving(null);

        if (!over) {
            return;
        }

        const next = reorderedIds(ids, String(active.id), String(over.id));

        if (next === ids) {
            return;
        }

        setPending({ source: statements, ids: next });
        onReorder(next);
    }

    return (
        <Card
            data-slot="health-statements"
            title={t('Health check statements')}
            className={className}
        >
            <div className="flex flex-col gap-4 px-5 pb-5 @max-card-narrow/card:px-4 @max-card-narrow/card:pb-4">
                <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                        {t(
                            'Changes apply to retros that have not collected answers yet.',
                        )}
                    </span>
                </p>
                {moving ? (
                    <span
                        aria-hidden
                        data-slot="health-statements-moving"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                        <MoveVerticalIcon className="size-4" />
                        {moving}
                    </span>
                ) : null}
                {ordered.length === 0 ? (
                    <p
                        data-slot="health-statements-empty"
                        className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground"
                    >
                        {t('No statements yet.')}
                    </p>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        accessibility={{
                            announcements,
                            screenReaderInstructions: {
                                draggable: t(
                                    'Press space to pick up, the up and down arrows to move, space to drop, escape to cancel.',
                                ),
                            },
                        }}
                        onDragStart={({ active }) =>
                            setMoving(
                                movingText(active.id, positionOf(active.id)),
                            )
                        }
                        onDragOver={({ active, over }) =>
                            over
                                ? setMoving(
                                      movingText(
                                          active.id,
                                          positionOf(over.id),
                                      ),
                                  )
                                : undefined
                        }
                        onDragCancel={() => setMoving(null)}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={ids}
                            strategy={verticalListSortingStrategy}
                        >
                            <ul className="flex flex-col divide-y rounded-lg border">
                                {ordered.map((statement) => (
                                    <StatementRow
                                        key={statement.id}
                                        statement={statement}
                                        canManage={canManage}
                                        editing={editingId === statement.id}
                                        onToggle={onToggle}
                                        onEditRequest={() =>
                                            setEditingId(statement.id)
                                        }
                                        onEditCancel={() => setEditingId(null)}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                )}
                {canManage ? (
                    <StatementFields
                        initial={{ label: '', text: '' }}
                        submitLabel={t('Add')}
                        submitIcon={PlusIcon}
                        onSubmit={onAdd}
                        labelPlaceholder={t('Short label')}
                        textPlaceholder={t(
                            'New statement, e.g. Our meetings were useful',
                        )}
                    />
                ) : null}
            </div>
        </Card>
    );
}
