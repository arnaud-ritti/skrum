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
import {
    ArchiveIcon,
    ArchiveRestoreIcon,
    CircleAlertIcon,
    GripVerticalIcon,
    InfoIcon,
    MoveVerticalIcon,
    PencilIcon,
    PlusIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** Same shape as `TeamHealthStatement`; the list keeps the server order. */
export interface HealthStatement {
    id: string;
    key?: string;
    label: string;
    text: string;
    isBuiltin: boolean;
    isArchived: boolean;
}

export interface HealthStatementDraft {
    label: string;
    text: string;
}

export interface HealthStatementErrors {
    text?: string;
    label?: string;
}

/** Resolving to `false` keeps the editor open (validation failed). */
type SaveResult = void | boolean | Promise<void | boolean>;

export interface HealthStatementsManagerProps {
    statements: HealthStatement[];
    canManage: boolean;
    /** Ids of the active statements, in their new order. */
    onReorder: (orderedIds: string[]) => void;
    onAdd: (statement: HealthStatementDraft) => SaveResult;
    /** Custom statements only; "Edit" is rendered only when given. */
    onEdit?: (id: string, statement: HealthStatementDraft) => SaveResult;
    onArchive?: (id: string) => void;
    onRestore?: (id: string) => void;
    /** Server errors of the add form. */
    addErrors?: HealthStatementErrors;
    /** Server errors of the open editor. */
    editErrors?: HealthStatementErrors;
    /** Error on the list itself (reorder, archive). */
    error?: string;
    defaultArchivedOpen?: boolean;
    className?: string;
}

export const healthStatementLabelMax = 30;
export const healthStatementTextMax = 150;

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

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <p
            id={id}
            role="alert"
            className="mt-1 flex items-start gap-1.5 text-xs font-medium text-skrum-destructive-text"
        >
            <CircleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{message}</span>
        </p>
    );
}

function StatementFields({
    initial,
    submitLabel,
    submitIcon: SubmitIcon,
    onSubmit,
    onCancel,
    textPlaceholder,
    errors,
    focusOnMount = false,
    className,
}: {
    initial: HealthStatementDraft;
    submitLabel: string;
    submitIcon?: typeof PlusIcon;
    onSubmit: (draft: HealthStatementDraft) => SaveResult;
    onCancel?: () => void;
    textPlaceholder: string;
    errors?: HealthStatementErrors;
    focusOnMount?: boolean;
    className?: string;
}) {
    const { t } = useTrans();
    const ids = useId();
    const textRef = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);
    const valid = isValidDraft(draft);
    const textErrorId = `${ids}-text-error`;
    const labelErrorId = `${ids}-label-error`;

    useEffect(() => {
        if (focusOnMount) {
            textRef.current?.focus();
            textRef.current?.select();
        }
    }, [focusOnMount]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!valid || saving) {
            return;
        }

        setSaving(true);

        const saved = await onSubmit({
            label: draft.label.trim(),
            text: draft.text.trim(),
        });

        setSaving(false);

        if (saved !== false) {
            setDraft(initial);
        }
    }

    return (
        <form
            onSubmit={(event) => void handleSubmit(event)}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && onCancel) {
                    event.stopPropagation();
                    onCancel();
                }
            }}
            className={cn(
                'grid gap-2 @lg/card:grid-cols-[minmax(0,1fr)_auto_auto] @lg/card:items-start',
                className,
            )}
        >
            <div className="min-w-0">
                <Input
                    ref={textRef}
                    name="text"
                    value={draft.text}
                    maxLength={healthStatementTextMax}
                    placeholder={textPlaceholder}
                    aria-label={t('Statement')}
                    aria-invalid={errors?.text ? true : undefined}
                    aria-describedby={errors?.text ? textErrorId : undefined}
                    onChange={(event) =>
                        setDraft({ ...draft, text: event.target.value })
                    }
                />
                <FieldError id={textErrorId} message={errors?.text} />
            </div>
            <div className="min-w-0 @lg/card:w-36">
                <Input
                    name="label"
                    value={draft.label}
                    maxLength={healthStatementLabelMax}
                    placeholder={t('Axis label')}
                    aria-label={t('Axis label')}
                    aria-invalid={errors?.label ? true : undefined}
                    aria-describedby={errors?.label ? labelErrorId : undefined}
                    onChange={(event) =>
                        setDraft({ ...draft, label: event.target.value })
                    }
                />
                <FieldError id={labelErrorId} message={errors?.label} />
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
                <Button
                    type="submit"
                    variant="secondary"
                    className="max-w-full"
                    disabled={!valid || saving}
                >
                    {SubmitIcon ? <SubmitIcon aria-hidden /> : null}
                    <span className="truncate">{submitLabel}</span>
                </Button>
                {onCancel ? (
                    <Button
                        type="button"
                        variant="ghost"
                        className="max-w-full"
                        onClick={onCancel}
                    >
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                ) : null}
            </div>
        </form>
    );
}

function StatementText({
    statement,
    muted = false,
}: {
    statement: HealthStatement;
    muted?: boolean;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 shrink grow basis-40 flex-col gap-0.5 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span
                    data-slot="health-statement-label"
                    className={cn(
                        'min-w-0 truncate text-sm font-bold',
                        muted && 'text-muted-foreground',
                    )}
                >
                    {statement.label}
                </span>
                {statement.isBuiltin ? (
                    <Badge variant="outline">{t('Built-in')}</Badge>
                ) : (
                    <Badge variant="soft">{t('Custom')}</Badge>
                )}
            </div>
            <p className="text-body-sm break-words text-muted-foreground">
                {statement.text}
            </p>
        </div>
    );
}

function StatementRow({
    statement,
    canManage,
    editing,
    editErrors,
    onEditRequest,
    onEditClose,
    onEdit,
    onArchive,
}: {
    statement: HealthStatement;
    canManage: boolean;
    editing: boolean;
    editErrors?: HealthStatementErrors;
    onEditRequest: () => void;
    onEditClose: () => void;
    onEdit?: (id: string, draft: HealthStatementDraft) => SaveResult;
    onArchive?: () => void;
}) {
    const { t } = useTrans();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: statement.id, disabled: !canManage });
    const handleHintId = useId();
    const canEdit = canManage && !statement.isBuiltin && onEdit !== undefined;
    const canArchive = canManage && onArchive !== undefined;

    return (
        <li
            ref={setNodeRef}
            data-slot="health-statement"
            data-statement-id={statement.id}
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
                    aria-label={t('Drag to reorder')}
                    aria-describedby={[
                        handleHintId,
                        attributes['aria-describedby'],
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    data-action="reorder"
                    className="flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                >
                    <GripVerticalIcon className="size-4" aria-hidden />
                    <span id={handleHintId} hidden>
                        {statement.label}
                    </span>
                </button>
            ) : null}
            {editing && onEdit ? (
                <div className="min-w-0 flex-1 py-2">
                    <StatementFields
                        focusOnMount
                        initial={{
                            label: statement.label,
                            text: statement.text,
                        }}
                        submitLabel={t('Save')}
                        errors={editErrors}
                        onSubmit={async (draft) => {
                            const saved = await onEdit(statement.id, draft);

                            if (saved !== false) {
                                onEditClose();
                            }

                            return saved;
                        }}
                        onCancel={onEditClose}
                        textPlaceholder={t('Statement')}
                    />
                </div>
            ) : (
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-end gap-x-2">
                    <StatementText statement={statement} />
                    {canEdit || canArchive ? (
                        <div className="flex min-h-11 max-w-full shrink-0 flex-wrap items-center gap-1">
                            {canEdit ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="max-w-full"
                                    data-action="edit"
                                    onClick={onEditRequest}
                                >
                                    <PencilIcon aria-hidden />
                                    <span className="truncate">
                                        {t('Edit')}
                                    </span>
                                </Button>
                            ) : null}
                            {canArchive ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="max-w-full"
                                    data-action="archive"
                                    onClick={onArchive}
                                >
                                    <ArchiveIcon aria-hidden />
                                    <span className="truncate">
                                        {t('Archive')}
                                    </span>
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}
        </li>
    );
}

type FocusTarget = (root: HTMLElement) => HTMLElement | null;

type PendingFocus = {
    /** The focus moves once this row has left the list it was in. */
    leaving: { id: string; archived: boolean };
    targets: FocusTarget[];
};

function rowAction(id: string, action: string): FocusTarget {
    return (root) => {
        const row = Array.from(
            root.querySelectorAll<HTMLElement>('[data-statement-id]'),
        ).find((element) => element.dataset.statementId === id);

        return (
            row?.querySelector<HTMLElement>(`[data-action="${action}"]`) ?? null
        );
    };
}

const archivedTrigger: FocusTarget = (root) =>
    root.querySelector<HTMLElement>('[data-slot="health-archived-trigger"]');

const addField: FocusTarget = (root) =>
    root.querySelector<HTMLElement>('[data-action="add-text"] input');

export function HealthStatementsManager({
    statements,
    canManage,
    onReorder,
    onAdd,
    onEdit,
    onArchive,
    onRestore,
    addErrors,
    editErrors,
    error,
    defaultArchivedOpen = false,
    className,
}: HealthStatementsManagerProps) {
    const { t } = useTrans();
    const rootRef = useRef<HTMLDivElement>(null);
    const pendingFocus = useRef<PendingFocus | null>(null);
    const closedEditorOf = useRef<string | null>(null);
    const [pending, setPending] = useState<{
        source: HealthStatement[];
        ids: string[];
    } | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [moving, setMoving] = useState<string | null>(null);
    const active = statements.filter((statement) => !statement.isArchived);
    const archived = statements.filter((statement) => statement.isArchived);
    const ids =
        pending && pending.source === statements
            ? pending.ids
            : active.map((statement) => statement.id);
    const byId = new Map(active.map((s) => [s.id, s]));
    const ordered = ids
        .map((id) => byId.get(id))
        .filter((s): s is HealthStatement => s !== undefined);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    useEffect(() => {
        const root = rootRef.current;

        if (!root) {
            return;
        }

        const focusFirst = (targets: FocusTarget[]): void => {
            for (const find of targets) {
                const target = find(root);

                if (target) {
                    target.focus();

                    return;
                }
            }
        };

        if (closedEditorOf.current !== null && editingId === null) {
            const id = closedEditorOf.current;

            closedEditorOf.current = null;
            focusFirst([
                rowAction(id, 'edit'),
                rowAction(id, 'reorder'),
                addField,
            ]);

            return;
        }

        const waiting = pendingFocus.current;

        if (waiting === null) {
            return;
        }

        const stillThere = statements.some(
            (statement) =>
                statement.id === waiting.leaving.id &&
                statement.isArchived === waiting.leaving.archived,
        );

        if (stillThere) {
            return;
        }

        pendingFocus.current = null;

        const focused = document.activeElement;

        if (focused === null || focused === document.body) {
            focusFirst(waiting.targets);
        }
    });

    function closeEditor(id: string) {
        closedEditorOf.current = id;
        setEditingId(null);
    }

    function archive(id: string) {
        const index = ordered.findIndex((statement) => statement.id === id);
        const neighbour = ordered[index + 1] ?? ordered[index - 1];

        pendingFocus.current = {
            leaving: { id, archived: false },
            targets: [
                ...(neighbour ? [rowAction(neighbour.id, 'archive')] : []),
                archivedTrigger,
                addField,
            ],
        };
        onArchive?.(id);
    }

    function restore(id: string) {
        const index = archived.findIndex((statement) => statement.id === id);
        const neighbour = archived[index + 1] ?? archived[index - 1];

        pendingFocus.current = {
            leaving: { id, archived: true },
            targets: [
                ...(neighbour ? [rowAction(neighbour.id, 'restore')] : []),
                rowAction(id, 'archive'),
                rowAction(id, 'reorder'),
                addField,
            ],
        };
        onRestore?.(id);
    }

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
        onDragStart: ({ active: dragged }) =>
            t('Picked up :label. Position :position of :total.', {
                label: labelOf(dragged.id),
                position: positionOf(dragged.id),
                total: ids.length,
            }),
        onDragOver: ({ active: dragged, over }) =>
            over ? movingText(dragged.id, positionOf(over.id)) : undefined,
        onDragEnd: ({ active: dragged, over }) =>
            t('Dropped :label. Position :position of :total.', {
                label: labelOf(dragged.id),
                position: positionOf(over?.id ?? dragged.id),
                total: ids.length,
            }),
        onDragCancel: ({ active: dragged }) =>
            t('Reordering cancelled. :label is back at position :position.', {
                label: labelOf(dragged.id),
                position: positionOf(dragged.id),
            }),
    };

    function handleDragEnd({ active: dragged, over }: DragEndEvent) {
        setMoving(null);

        if (!over) {
            return;
        }

        const next = reorderedIds(ids, String(dragged.id), String(over.id));

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
            <div
                ref={rootRef}
                className="flex flex-col gap-4 px-5 pb-5 @max-card-narrow/card:px-4 @max-card-narrow/card:pb-4"
            >
                <p className="flex items-start gap-2 text-body-sm text-muted-foreground">
                    <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                        {t(
                            'Changes apply to retros that have not collected answers yet.',
                        )}
                    </span>
                </p>
                {error ? (
                    <p
                        role="alert"
                        data-slot="health-statements-error"
                        className="flex items-start gap-1.5 text-body-sm font-medium text-skrum-destructive-text"
                    >
                        <CircleAlertIcon
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden
                        />
                        <span className="min-w-0 break-words">{error}</span>
                    </p>
                ) : null}
                {moving ? (
                    <span
                        aria-hidden
                        data-slot="health-statements-moving"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                        <MoveVerticalIcon className="size-4 shrink-0" />
                        <span className="min-w-0 break-words">{moving}</span>
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
                        id="health-statements"
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
                        onDragStart={({ active: dragged }) =>
                            setMoving(
                                movingText(dragged.id, positionOf(dragged.id)),
                            )
                        }
                        onDragOver={({ active: dragged, over }) =>
                            over
                                ? setMoving(
                                      movingText(
                                          dragged.id,
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
                            <ol
                                data-slot="health-statements-active"
                                className="flex flex-col divide-y rounded-lg border"
                            >
                                {ordered.map((statement) => (
                                    <StatementRow
                                        key={statement.id}
                                        statement={statement}
                                        canManage={canManage}
                                        editing={editingId === statement.id}
                                        editErrors={editErrors}
                                        onEditRequest={() =>
                                            setEditingId(statement.id)
                                        }
                                        onEditClose={() =>
                                            closeEditor(statement.id)
                                        }
                                        onEdit={onEdit}
                                        onArchive={
                                            onArchive
                                                ? () => archive(statement.id)
                                                : undefined
                                        }
                                    />
                                ))}
                            </ol>
                        </SortableContext>
                    </DndContext>
                )}
                {canManage ? (
                    <div data-action="add-text">
                        <StatementFields
                            initial={{ label: '', text: '' }}
                            submitLabel={t('Add statement')}
                            submitIcon={PlusIcon}
                            errors={addErrors}
                            onSubmit={onAdd}
                            textPlaceholder={t(
                                'New statement, e.g. Our meetings were useful',
                            )}
                        />
                    </div>
                ) : null}
                {archived.length > 0 ? (
                    <Collapsible defaultOpen={defaultArchivedOpen}>
                        <CollapsibleTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="max-w-full"
                                data-slot="health-archived-trigger"
                            >
                                <ArchiveIcon aria-hidden />
                                <span className="truncate">
                                    {t('Archived (:count)', {
                                        count: archived.length,
                                    })}
                                </span>
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ul
                                data-slot="health-statements-archived"
                                className="mt-2 flex flex-col divide-y rounded-lg border"
                            >
                                {archived.map((statement) => (
                                    <li
                                        key={statement.id}
                                        data-slot="health-statement"
                                        data-statement-id={statement.id}
                                        data-archived
                                        className="flex flex-wrap items-start justify-end gap-x-2 px-3 py-1 @max-card-narrow/card:px-2"
                                    >
                                        <StatementText
                                            statement={statement}
                                            muted
                                        />
                                        {canManage && onRestore ? (
                                            <div className="flex min-h-11 max-w-full shrink-0 items-center">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="max-w-full"
                                                    data-action="restore"
                                                    onClick={() =>
                                                        restore(statement.id)
                                                    }
                                                >
                                                    <ArchiveRestoreIcon
                                                        aria-hidden
                                                    />
                                                    <span className="truncate">
                                                        {t('Restore')}
                                                    </span>
                                                </Button>
                                            </div>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>
                ) : null}
            </div>
        </Card>
    );
}
