import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type Announcements,
    type DragEndEvent,
    type UniqueIdentifier,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Form, router, usePage } from '@inertiajs/react';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';
import TeamHealthStatementArchivalsController from '@/actions/App/Http/Controllers/TeamHealthStatementArchivalsController';
import TeamHealthStatementOrdersController from '@/actions/App/Http/Controllers/TeamHealthStatementOrdersController';
import TeamHealthStatementsController from '@/actions/App/Http/Controllers/TeamHealthStatementsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type { TeamHealthStatement } from '@/types';

type Params = { workspace: string; team: string };

type Props = {
    statements: TeamHealthStatement[];
    canManage: boolean;
    params: Params;
};

export function HealthStatementsSection({
    statements,
    canManage,
    params,
}: Props) {
    const { t } = useTrans();
    const { errors } = usePage().props as {
        errors: Record<string, string | undefined>;
    };
    const active = statements.filter((statement) => !statement.isArchived);
    const archived = statements.filter((statement) => statement.isArchived);
    const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
    const ordered = pendingOrder
        ? pendingOrder
              .map((id) => active.find((statement) => statement.id === id))
              .filter(
                  (statement): statement is TeamHealthStatement =>
                      statement !== undefined,
              )
        : active;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const labelOf = (id: UniqueIdentifier | undefined): string =>
        ordered.find((statement) => statement.id === id)?.label ?? '';

    const announcements: Announcements = {
        onDragStart: ({ active: dragged }) =>
            t('Picked up :statement.', { statement: labelOf(dragged.id) }),
        onDragOver: ({ active: dragged, over }) =>
            over
                ? t('Moved :statement to position :position.', {
                      statement: labelOf(dragged.id),
                      position:
                          ordered.findIndex(
                              (statement) => statement.id === over.id,
                          ) + 1,
                  })
                : undefined,
        onDragEnd: ({ active: dragged }) =>
            t('Dropped :statement.', { statement: labelOf(dragged.id) }),
        onDragCancel: () => t('Reordering cancelled.'),
    };

    const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
        if (!over || dragged.id === over.id) {
            return;
        }

        const ids = ordered.map((statement) => statement.id);
        const next = arrayMove(
            ids,
            ids.indexOf(String(dragged.id)),
            ids.indexOf(String(over.id)),
        );

        setPendingOrder(next);
        router.put(
            TeamHealthStatementOrdersController.update.url(params),
            { ids: next },
            { preserveScroll: true, onFinish: () => setPendingOrder(null) },
        );
    };

    return (
        <section className="space-y-3">
            <Heading
                variant="small"
                title={t('Health check statements')}
                description={t(
                    'Changes apply to retros that have not collected answers yet.',
                )}
            />

            <InputError message={errors.statements ?? errors.ids} />

            <DndContext
                id="health-statements"
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{
                    announcements,
                    screenReaderInstructions: {
                        draggable: t(
                            'To pick up a statement, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
                        ),
                    },
                }}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={ordered.map((statement) => statement.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="divide-y rounded-md border">
                        {ordered.map((statement) => (
                            <StatementRow
                                key={statement.id}
                                statement={statement}
                                canManage={canManage}
                                params={params}
                            />
                        ))}
                    </ol>
                </SortableContext>
            </DndContext>

            {canManage && (
                <Form
                    {...TeamHealthStatementsController.store.form(params)}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    className="flex flex-wrap items-start gap-2"
                >
                    {({ processing, errors: formErrors }) => (
                        <>
                            <div className="min-w-64 flex-1">
                                <Input
                                    name="text"
                                    required
                                    maxLength={150}
                                    placeholder={t('Statement')}
                                    aria-label={t('Statement')}
                                />
                                <InputError message={formErrors.text} />
                            </div>
                            <div className="w-40">
                                <Input
                                    name="label"
                                    required
                                    maxLength={30}
                                    placeholder={t('Axis label')}
                                    aria-label={t('Axis label')}
                                />
                                <InputError message={formErrors.label} />
                            </div>
                            <Button disabled={processing}>
                                {t('Add statement')}
                            </Button>
                        </>
                    )}
                </Form>
            )}

            {archived.length > 0 && (
                <Collapsible>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm">
                            {t('Archived (:count)', {
                                count: archived.length,
                            })}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <ul className="divide-y rounded-md border">
                            {archived.map((statement) => (
                                <li
                                    key={statement.id}
                                    className="flex items-center justify-between gap-3 p-3 text-muted-foreground"
                                >
                                    <StatementText statement={statement} />
                                    {canManage && (
                                        <Form
                                            {...TeamHealthStatementArchivalsController.destroy.form(
                                                {
                                                    ...params,
                                                    statement: statement.id,
                                                },
                                            )}
                                            options={{ preserveScroll: true }}
                                        >
                                            {({ processing }) => (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={processing}
                                                >
                                                    {t('Restore')}
                                                </Button>
                                            )}
                                        </Form>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </section>
    );
}

function StatementText({ statement }: { statement: TeamHealthStatement }) {
    const { t } = useTrans();

    return (
        <div className="min-w-0 flex-1">
            <div className="break-words">{statement.text}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{statement.label}</span>
                {statement.isBuiltin && (
                    <Badge variant="secondary">{t('Built-in')}</Badge>
                )}
            </div>
        </div>
    );
}

function StatementRow({
    statement,
    canManage,
    params,
}: {
    statement: TeamHealthStatement;
    canManage: boolean;
    params: Params;
}) {
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: statement.id, disabled: !canManage });

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className="flex items-center gap-3 bg-background p-3 data-[dragging=true]:opacity-60"
            data-dragging={isDragging}
        >
            {canManage && (
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="cursor-grab text-muted-foreground"
                    aria-label={t('Drag to reorder')}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}

            {editing ? (
                <Form
                    {...TeamHealthStatementsController.update.form({
                        ...params,
                        statement: statement.id,
                    })}
                    options={{ preserveScroll: true }}
                    onSuccess={() => setEditing(false)}
                    className="flex flex-1 flex-wrap items-start gap-2"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="min-w-48 flex-1">
                                <Input
                                    name="text"
                                    required
                                    maxLength={150}
                                    defaultValue={statement.text}
                                    aria-label={t('Statement')}
                                />
                                <InputError message={errors.text} />
                            </div>
                            <div className="w-36">
                                <Input
                                    name="label"
                                    required
                                    maxLength={30}
                                    defaultValue={statement.label}
                                    aria-label={t('Axis label')}
                                />
                                <InputError message={errors.label} />
                            </div>
                            <Button size="sm" disabled={processing}>
                                {t('Save')}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(false)}
                            >
                                {t('Cancel')}
                            </Button>
                        </>
                    )}
                </Form>
            ) : (
                <StatementText statement={statement} />
            )}

            {canManage && !editing && (
                <div className="flex shrink-0 gap-1">
                    {!statement.isBuiltin && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(true)}
                        >
                            {t('Edit')}
                        </Button>
                    )}
                    <Form
                        {...TeamHealthStatementArchivalsController.update.form({
                            ...params,
                            statement: statement.id,
                        })}
                        options={{ preserveScroll: true }}
                    >
                        {({ processing }) => (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={processing}
                            >
                                {t('Archive')}
                            </Button>
                        )}
                    </Form>
                </div>
            )}
        </li>
    );
}
