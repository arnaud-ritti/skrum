import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type {
    Announcements,
    DragEndEvent,
    DragStartEvent,
    Modifier,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Building2,
    GripVertical,
    Minus,
    Plus,
    Trash2,
    User,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import {
    ColumnColorPicker,
    columnColorClasses,
    columnColors,
} from '@/components/skrum/column-color-picker';
import type { ColumnColor } from '@/components/skrum/column-color-picker';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup } from '@/components/ui/toggle-group';
import type { ToggleOption } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type { ColumnColor } from '@/components/skrum/column-color-picker';

export type TemplateVisibility = 'personal' | 'team' | 'workspace';

export type TemplatePhase = 'writing' | 'voting' | 'discussing';

export type TemplateColumnDraft = {
    id: string;
    title: string;
    help?: string;
    color: ColumnColor;
};

export type TemplateDraft = {
    name: string;
    description?: string;
    visibility: TemplateVisibility;
    columns: TemplateColumnDraft[];
    defaults: {
        votesPerPerson: number;
        maxPerCard: number;
        anonymous: boolean;
        timers: Partial<Record<TemplatePhase, number>>;
    };
};

export type TemplateEditorErrors = Partial<
    Record<'name' | `columns.${number}.title`, string>
>;

export type TemplateEditorProps = {
    mode: 'create' | 'edit';
    value: TemplateDraft;
    onChange: (draft: TemplateDraft) => void;
    errors?: TemplateEditorErrors;
    canShareWorkspace?: boolean;
    meta?: { editedBy: string; editedAt: string; usedByTeams?: number };
    saving?: boolean;
    onSave: () => void;
    onCancel: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    className?: string;
};

export const MaxTemplateColumns = 8;

const MaxVotes = 20;

const timerMinutes = [1, 2, 3, 5, 10, 15, 20, 30];

export type ColumnProblem =
    | { kind: 'empty' }
    | { kind: 'duplicate'; otherTitle: string };

export function normalizeColumnTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findColumnProblems(
    columns: TemplateColumnDraft[],
): Record<number, ColumnProblem> {
    const problems: Record<number, ColumnProblem> = {};
    const firstByTitle = new Map<string, string>();

    columns.forEach((column, index) => {
        const normalized = normalizeColumnTitle(column.title);

        if (normalized === '') {
            problems[index] = { kind: 'empty' };

            return;
        }

        const first = firstByTitle.get(normalized);

        if (first === undefined) {
            firstByTitle.set(normalized, column.title.trim());

            return;
        }

        problems[index] = { kind: 'duplicate', otherTitle: first };
    });

    return problems;
}

export function firstFreeColor(columns: TemplateColumnDraft[]): ColumnColor {
    const used = new Set(columns.map((column) => column.color));

    return (
        columnColors.find((color) => !used.has(color)) ??
        columnColors[columns.length % columnColors.length]
    );
}

export function swapColumnColor(
    columns: TemplateColumnDraft[],
    index: number,
    color: ColumnColor,
): TemplateColumnDraft[] {
    const previous = columns[index].color;

    if (previous === color) {
        return columns;
    }

    return columns.map((column, position) => {
        if (position === index) {
            return { ...column, color };
        }

        if (column.color === color) {
            return { ...column, color: previous };
        }

        return column;
    });
}

const visibilityIcons: Record<TemplateVisibility, LucideIcon> = {
    personal: User,
    team: Users,
    workspace: Building2,
};

const lockToVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

let columnCounter = 0;

function newColumnId(): string {
    columnCounter += 1;

    return `new-column-${Date.now().toString(36)}-${columnCounter}`;
}

function formatEditedAt(value: string): string {
    const time = Date.parse(value);

    if (Number.isNaN(time)) {
        return value;
    }

    const seconds = Math.round((time - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536000],
        ['month', 2592000],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ];
    const formatter = new Intl.RelativeTimeFormat(
        document.documentElement.lang || 'en',
        { numeric: 'auto' },
    );

    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) {
            return formatter.format(Math.round(seconds / size), unit);
        }
    }

    return formatter.format(0, 'minute');
}

function IconTip({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function SectionLabel({
    id,
    children,
    aside,
}: {
    id?: string;
    children: ReactNode;
    aside?: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <h3
                id={id}
                className="min-w-0 truncate text-overline text-muted-foreground uppercase"
            >
                {children}
            </h3>
            {aside}
        </div>
    );
}

function FieldError({ id, message }: { id: string; message?: string }) {
    if (message === undefined) {
        return null;
    }

    return (
        <p id={id} role="alert" className="text-xs text-skrum-destructive-text">
            {message}
        </p>
    );
}

function Stepper({
    label,
    value,
    min,
    max,
    onChange,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 text-sm">{label}</span>
            <div
                role="group"
                aria-label={label}
                className="flex shrink-0 items-center gap-1"
            >
                <IconTip label={t('Decrease')}>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('Decrease :label', { label })}
                        disabled={value <= min}
                        onClick={() => onChange(value - 1)}
                    >
                        <Minus aria-hidden="true" />
                    </Button>
                </IconTip>
                <output className="w-8 text-center text-sm font-semibold tabular-nums">
                    {value}
                </output>
                <IconTip label={t('Increase')}>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={t('Increase :label', { label })}
                        disabled={value >= max}
                        onClick={() => onChange(value + 1)}
                    >
                        <Plus aria-hidden="true" />
                    </Button>
                </IconTip>
            </div>
        </div>
    );
}

function TimerSelect({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number | undefined;
    onChange: (value: number | undefined) => void;
}) {
    const { t } = useTrans();
    const minutes = [...timerMinutes];

    if (value !== undefined && !minutes.includes(value)) {
        minutes.push(value);
        minutes.sort((first, second) => first - second);
    }

    return (
        <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{label}</span>
            <Select
                value={value === undefined ? 'off' : String(value)}
                onValueChange={(next) =>
                    onChange(next === 'off' ? undefined : Number(next))
                }
            >
                <SelectTrigger
                    size="sm"
                    aria-label={label}
                    className="w-32 shrink-0"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="off">{t('No timer')}</SelectItem>
                    {minutes.map((count) => (
                        <SelectItem key={count} value={String(count)}>
                            {t(':count min', { count })}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

type RowProps = {
    column: TemplateColumnDraft;
    index: number;
    total: number;
    usedBy: Partial<Record<ColumnColor, string>>;
    error?: string;
    canDelete: boolean;
    registerTitle: (id: string, node: HTMLInputElement | null) => void;
    onTitleChange: (title: string) => void;
    onTitleBlur: () => void;
    onHelpChange: (help: string) => void;
    onColorChange: (color: ColumnColor) => void;
    onDelete: () => void;
};

function SortableColumnRow(props: RowProps) {
    const { t } = useTrans();
    const { column, index, total, error, canDelete } = props;
    const errorId = useId();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: column.id,
        attributes: { roleDescription: t('sortable') },
    });
    const displayTitle =
        column.title.trim() === '' ? t('Untitled') : column.title;

    const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
        if (event.key !== 'Delete' || !canDelete) {
            return;
        }

        const target = event.target as HTMLElement;

        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            return;
        }

        event.preventDefault();
        props.onDelete();
    };

    return (
        <li
            ref={setNodeRef}
            data-slot="template-column-row"
            data-dragging={isDragging ? 'true' : undefined}
            aria-invalid={error === undefined ? undefined : true}
            onKeyDown={handleKeyDown}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                'grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-lg border bg-card p-2 aria-invalid:border-destructive',
                isDragging &&
                    'border-2 border-dashed border-ring bg-primary/8 *:invisible',
            )}
        >
            <IconTip label={t('Drag or press Space to reorder')}>
                <button
                    ref={setActivatorNodeRef}
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label={t(
                        'Reorder “:title”, position :position of :total',
                        {
                            title: displayTitle,
                            position: index + 1,
                            total,
                        },
                    )}
                    className="grid h-8 w-6 cursor-grab touch-none place-items-center rounded-sm text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                >
                    <GripVertical aria-hidden="true" className="size-4" />
                </button>
            </IconTip>
            <ColumnColorPicker
                value={column.color}
                onValueChange={props.onColorChange}
                usedBy={props.usedBy}
                columnTitle={column.title}
            />
            <Input
                ref={(node) => props.registerTitle(column.id, node)}
                value={column.title}
                aria-label={t('Column :position title', {
                    position: index + 1,
                })}
                aria-invalid={error === undefined ? undefined : true}
                aria-describedby={error === undefined ? undefined : errorId}
                placeholder={t('Column title')}
                maxLength={60}
                onChange={(event) => props.onTitleChange(event.target.value)}
                onBlur={props.onTitleBlur}
                className="h-8"
            />
            <IconTip label={t('Delete column (Del)')}>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Delete column “:title”', {
                        title: displayTitle,
                    })}
                    disabled={!canDelete}
                    onClick={props.onDelete}
                    className="text-skrum-destructive-text hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text"
                >
                    <Trash2 aria-hidden="true" />
                </Button>
            </IconTip>
            <Input
                value={column.help ?? ''}
                aria-label={t('Column :position help question', {
                    position: index + 1,
                })}
                placeholder={t('Help question (optional)')}
                maxLength={140}
                onChange={(event) => props.onHelpChange(event.target.value)}
                className="col-span-2 col-start-3 h-7 text-xs"
            />
            {error !== undefined && (
                <div className="col-span-2 col-start-3">
                    <FieldError id={errorId} message={error} />
                </div>
            )}
        </li>
    );
}

function MiniPreview({ columns }: { columns: TemplateColumnDraft[] }) {
    const { t } = useTrans();

    return (
        <div
            data-slot="template-preview"
            className="flex flex-wrap gap-2 rounded-lg border bg-skrum-canvas p-2"
        >
            {columns.map((column) => {
                const empty = column.title.trim() === '';

                return (
                    <div
                        key={column.id}
                        className="flex min-w-24 flex-1 flex-col gap-1.5 rounded-md bg-muted p-2"
                    >
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'size-2.5 shrink-0 rounded-full',
                                    columnColorClasses[column.color].dot,
                                )}
                            />
                            <span
                                className={cn(
                                    'min-w-0 truncate text-xs font-semibold',
                                    empty
                                        ? 'font-normal text-muted-foreground italic'
                                        : 'text-foreground',
                                )}
                            >
                                {empty ? t('Untitled') : column.title}
                            </span>
                        </div>
                        <span
                            aria-hidden="true"
                            className="h-5 rounded-sm bg-card shadow-card"
                        />
                        <span
                            aria-hidden="true"
                            className="h-5 w-3/4 rounded-sm bg-card shadow-card"
                        />
                    </div>
                );
            })}
        </div>
    );
}

export function TemplateEditor({
    mode,
    value,
    onChange,
    errors,
    canShareWorkspace = true,
    meta,
    saving = false,
    onSave,
    onCancel,
    onDuplicate,
    onDelete,
    className,
}: TemplateEditorProps) {
    const { t } = useTrans();
    const headingId = useId();
    const nameId = useId();
    const nameErrorId = useId();
    const descriptionId = useId();
    const visibilityHelpId = useId();
    const [submitted, setSubmitted] = useState(false);
    const [nameTouched, setNameTouched] = useState(false);
    const [touched, setTouched] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const nameRef = useRef<HTMLInputElement>(null);
    const titleRefs = useRef(new Map<string, HTMLInputElement>());
    const pendingFocus = useRef<string | null>(null);
    const latest = useRef(value);

    latest.current = value;

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    useEffect(() => {
        if (pendingFocus.current === null) {
            return;
        }

        titleRefs.current.get(pendingFocus.current)?.focus();
        pendingFocus.current = null;
    }, [value.columns.length]);

    const update = (patch: Partial<TemplateDraft>) =>
        onChange({ ...latest.current, ...patch });

    const updateDefaults = (patch: Partial<TemplateDraft['defaults']>) =>
        update({ defaults: { ...latest.current.defaults, ...patch } });

    const problems = findColumnProblems(value.columns);
    const nameProblem = value.name.trim() === '';

    const problemMessage = (problem: ColumnProblem): string =>
        problem.kind === 'empty'
            ? t('Give this column a title.')
            : t('Another column is already called “:title”.', {
                  title: problem.otherTitle,
              });

    const nameError =
        errors?.name ??
        (nameProblem && (submitted || nameTouched)
            ? t('Give this template a name.')
            : undefined);

    const columnError = (index: number): string | undefined => {
        const server = errors?.[`columns.${index}.title`];

        if (server !== undefined) {
            return server;
        }

        const problem = problems[index];

        if (problem === undefined) {
            return undefined;
        }

        if (submitted || touched.has(value.columns[index].id)) {
            return problemMessage(problem);
        }

        return undefined;
    };

    const visibleErrorCount =
        (nameError === undefined ? 0 : 1) +
        value.columns.filter((_, index) => columnError(index) !== undefined)
            .length;

    const registerTitle = (id: string, node: HTMLInputElement | null) => {
        if (node === null) {
            titleRefs.current.delete(id);

            return;
        }

        titleRefs.current.set(id, node);
    };

    const focusFirstInvalid = () => {
        if (nameProblem || errors?.name !== undefined) {
            nameRef.current?.focus();

            return;
        }

        const index = value.columns.findIndex(
            (_, position) =>
                problems[position] !== undefined ||
                errors?.[`columns.${position}.title`] !== undefined,
        );

        if (index >= 0) {
            titleRefs.current.get(value.columns[index].id)?.focus();
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (saving) {
            return;
        }

        setSubmitted(true);

        const hasLocalProblem = nameProblem || Object.keys(problems).length > 0;

        if (hasLocalProblem) {
            focusFirstInvalid();

            return;
        }

        onSave();
    };

    const setColumns = (columns: TemplateColumnDraft[]) => update({ columns });

    const addColumn = () => {
        if (value.columns.length >= MaxTemplateColumns) {
            return;
        }

        const column: TemplateColumnDraft = {
            id: newColumnId(),
            title: '',
            color: firstFreeColor(value.columns),
        };

        pendingFocus.current = column.id;
        setColumns([...value.columns, column]);
    };

    const removeColumn = (index: number) => {
        const current = latest.current.columns;

        if (current.length <= 1) {
            return;
        }

        const removed = current[index];

        setColumns(current.filter((_, position) => position !== index));

        toast(
            t('Column “:title” deleted', {
                title:
                    removed.title.trim() === '' ? t('Untitled') : removed.title,
            }),
            {
                duration: 5000,
                action: {
                    label: t('Undo'),
                    onClick: () => {
                        const columns = [...latest.current.columns];

                        if (
                            columns.some((column) => column.id === removed.id)
                        ) {
                            return;
                        }

                        columns.splice(
                            Math.min(index, columns.length),
                            0,
                            removed,
                        );
                        onChange({ ...latest.current, columns });
                    },
                },
            },
        );
    };

    const patchColumn = (index: number, patch: Partial<TemplateColumnDraft>) =>
        setColumns(
            value.columns.map((column, position) =>
                position === index ? { ...column, ...patch } : column,
            ),
        );

    const usedByFor = (index: number) => {
        const used: Partial<Record<ColumnColor, string>> = {};

        value.columns.forEach((column, position) => {
            if (position === index) {
                return;
            }

            used[column.color] =
                column.title.trim() === '' ? t('Untitled') : column.title;
        });

        return used;
    };

    const titleOf = (id: string | number): string => {
        const column = value.columns.find((entry) => entry.id === id);

        return column === undefined || column.title.trim() === ''
            ? t('Untitled')
            : column.title;
    };

    const positionOf = (id: string | number): number =>
        value.columns.findIndex((entry) => entry.id === id) + 1;

    const announcements: Announcements = {
        onDragStart: ({ active }) =>
            t('Picked up “:title”, position :position of :total', {
                title: titleOf(active.id),
                position: positionOf(active.id),
                total: value.columns.length,
            }),
        onDragOver: ({ active, over }) =>
            over === null
                ? undefined
                : t('“:title” moved to position :position of :total', {
                      title: titleOf(active.id),
                      position: positionOf(over.id),
                      total: value.columns.length,
                  }),
        onDragEnd: ({ active, over }) =>
            t('“:title” dropped at position :position of :total', {
                title: titleOf(active.id),
                position: positionOf(over === null ? active.id : over.id),
                total: value.columns.length,
            }),
        onDragCancel: ({ active }) =>
            t('Move cancelled, “:title” back at position :position of :total', {
                title: titleOf(active.id),
                position: positionOf(active.id),
                total: value.columns.length,
            }),
    };

    const handleDragStart = (event: DragStartEvent) =>
        setActiveId(String(event.active.id));

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);

        const { active, over } = event;

        if (over === null || active.id === over.id) {
            return;
        }

        const from = value.columns.findIndex((entry) => entry.id === active.id);
        const to = value.columns.findIndex((entry) => entry.id === over.id);

        if (from < 0 || to < 0) {
            return;
        }

        setAnnouncement(
            t('“:title” moved to position :position of :total', {
                title: titleOf(active.id),
                position: to + 1,
                total: value.columns.length,
            }),
        );
        setColumns(arrayMove(value.columns, from, to));
    };

    const visibilityOptions: ToggleOption<TemplateVisibility>[] = [
        {
            value: 'personal',
            label: t('Personal'),
            icon: User,
        },
        { value: 'team', label: t('Team'), icon: Users },
        {
            value: 'workspace',
            label: t('Workspace'),
            icon: Building2,
            disabled: !canShareWorkspace,
        },
    ];

    const visibilityLabels: Record<TemplateVisibility, string> = {
        personal: t('Personal'),
        team: t('Team'),
        workspace: t('Workspace'),
    };

    const visibilityHelp: Record<TemplateVisibility, string> = {
        personal: t('Only you can use this template.'),
        team: t('Everyone in your team can use this template.'),
        workspace: t('Everyone in the workspace can use this template.'),
    };

    const atLimit = value.columns.length >= MaxTemplateColumns;
    const remaining = MaxTemplateColumns - value.columns.length;
    const activeColumn = value.columns.find((column) => column.id === activeId);
    const VisibilityIcon = visibilityIcons[value.visibility];
    const { defaults } = value;

    return (
        <form
            aria-labelledby={headingId}
            data-slot="template-editor"
            noValidate
            onSubmit={handleSubmit}
            className={cn(
                '@container/editor flex min-w-0 flex-col rounded-lg border bg-card text-card-foreground',
                className,
            )}
        >
            <header className="flex min-w-0 flex-col gap-1 border-b p-5">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <h2
                        id={headingId}
                        className="min-w-0 truncate text-lg font-semibold"
                    >
                        {mode === 'create'
                            ? t('New template')
                            : t('Edit template')}
                    </h2>
                    <Badge variant="muted" icon={VisibilityIcon}>
                        {visibilityLabels[value.visibility]}
                    </Badge>
                </div>
                <p className="min-w-0 truncate text-xs text-muted-foreground">
                    {t('Retro')}
                    {meta !== undefined &&
                        ` · ${t('edited by :name :when', {
                            name: meta.editedBy,
                            when: formatEditedAt(meta.editedAt),
                        })}`}
                    {meta?.usedByTeams !== undefined &&
                        ` · ${t(':count teams use it', {
                            count: meta.usedByTeams,
                        })}`}
                </p>
            </header>

            <div className="grid gap-5 p-5 @3xl/editor:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={nameId} className="text-sm font-medium">
                            {t('Name')}
                        </label>
                        <Input
                            id={nameId}
                            ref={nameRef}
                            value={value.name}
                            maxLength={80}
                            aria-invalid={
                                nameError === undefined ? undefined : true
                            }
                            aria-describedby={
                                nameError === undefined
                                    ? undefined
                                    : nameErrorId
                            }
                            onChange={(event) =>
                                update({ name: event.target.value })
                            }
                            onBlur={() => setNameTouched(true)}
                        />
                        <FieldError id={nameErrorId} message={nameError} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor={descriptionId}
                            className="text-sm font-medium"
                        >
                            {t('Description')}
                        </label>
                        <Textarea
                            id={descriptionId}
                            value={value.description ?? ''}
                            rows={2}
                            maxLength={280}
                            onChange={(event) =>
                                update({ description: event.target.value })
                            }
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">
                            {t('Visibility')}
                        </span>
                        <ToggleGroup
                            type="single"
                            variant="segmented"
                            fullWidth
                            aria-label={t('Visibility')}
                            value={value.visibility}
                            options={visibilityOptions}
                            onValueChange={(next) =>
                                update({ visibility: next })
                            }
                            className="grid grid-cols-3"
                        />
                        <p
                            id={visibilityHelpId}
                            className="text-xs text-muted-foreground"
                        >
                            {canShareWorkspace
                                ? visibilityHelp[value.visibility]
                                : t(
                                      'Only workspace admins can share templates with the whole workspace.',
                                  )}
                        </p>
                    </div>

                    <section
                        aria-label={t('Columns')}
                        className="flex flex-col gap-2"
                    >
                        <SectionLabel
                            aside={
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {value.columns.length}/{MaxTemplateColumns}
                                </span>
                            }
                        >
                            {t('Columns')}
                        </SectionLabel>
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            modifiers={[lockToVertical]}
                            accessibility={{
                                announcements,
                                screenReaderInstructions: {
                                    draggable: t(
                                        'Press Space to pick up the column, the arrow keys to move it, Space to drop it and Escape to cancel.',
                                    ),
                                },
                            }}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragCancel={() => setActiveId(null)}
                        >
                            <SortableContext
                                items={value.columns.map((column) => column.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <ol className="flex flex-col gap-2">
                                    {value.columns.map((column, index) => (
                                        <SortableColumnRow
                                            key={column.id}
                                            column={column}
                                            index={index}
                                            total={value.columns.length}
                                            usedBy={usedByFor(index)}
                                            error={columnError(index)}
                                            canDelete={value.columns.length > 1}
                                            registerTitle={registerTitle}
                                            onTitleChange={(title) =>
                                                patchColumn(index, { title })
                                            }
                                            onTitleBlur={() =>
                                                setTouched((current) =>
                                                    new Set(current).add(
                                                        column.id,
                                                    ),
                                                )
                                            }
                                            onHelpChange={(help) =>
                                                patchColumn(index, { help })
                                            }
                                            onColorChange={(color) =>
                                                setColumns(
                                                    swapColumnColor(
                                                        value.columns,
                                                        index,
                                                        color,
                                                    ),
                                                )
                                            }
                                            onDelete={() => removeColumn(index)}
                                        />
                                    ))}
                                </ol>
                            </SortableContext>
                            <DragOverlay>
                                {activeColumn === undefined ? null : (
                                    <div
                                        data-slot="template-column-drag"
                                        className="z-50 flex -rotate-1 items-center gap-2 rounded-lg border border-ring bg-card p-2 shadow-drag"
                                    >
                                        <GripVertical
                                            aria-hidden="true"
                                            className="size-4 text-muted-foreground"
                                        />
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'size-4.5 shrink-0 rounded-full',
                                                columnColorClasses[
                                                    activeColumn.color
                                                ].dot,
                                            )}
                                        />
                                        <span className="min-w-0 truncate text-sm">
                                            {activeColumn.title.trim() === ''
                                                ? t('Untitled')
                                                : activeColumn.title}
                                        </span>
                                    </div>
                                )}
                            </DragOverlay>
                        </DndContext>
                        <span className="sr-only" aria-live="polite">
                            {announcement}
                        </span>
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={atLimit}
                                onClick={addColumn}
                            >
                                <Plus aria-hidden="true" />
                                <span className="truncate">
                                    {t('Add a column')}
                                </span>
                            </Button>
                            <span className="min-w-0 text-xs text-muted-foreground">
                                {atLimit
                                    ? t(
                                          'You reached the limit of :max columns.',
                                          {
                                              max: MaxTemplateColumns,
                                          },
                                      )
                                    : t(':count more available', {
                                          count: remaining,
                                      })}
                            </span>
                        </div>
                    </section>
                </div>

                <div className="flex min-w-0 flex-col gap-5">
                    <section className="flex flex-col gap-2">
                        <SectionLabel>{t('Live preview')}</SectionLabel>
                        <MiniPreview columns={value.columns} />
                    </section>

                    <section className="flex flex-col gap-3">
                        <SectionLabel>{t('Default settings')}</SectionLabel>
                        <Stepper
                            label={t('Votes per person')}
                            value={defaults.votesPerPerson}
                            min={0}
                            max={MaxVotes}
                            onChange={(votesPerPerson) =>
                                updateDefaults({
                                    votesPerPerson,
                                    maxPerCard: Math.min(
                                        defaults.maxPerCard,
                                        Math.max(votesPerPerson, 1),
                                    ),
                                })
                            }
                        />
                        <Stepper
                            label={t('Max votes per card')}
                            value={defaults.maxPerCard}
                            min={1}
                            max={Math.max(defaults.votesPerPerson, 1)}
                            onChange={(maxPerCard) =>
                                updateDefaults({ maxPerCard })
                            }
                        />
                        <div className="flex min-w-0 items-center justify-between gap-3">
                            <span className="min-w-0 text-sm">
                                {t('Anonymous cards')}
                            </span>
                            <Switch
                                checked={defaults.anonymous}
                                aria-label={t('Anonymous cards')}
                                onCheckedChange={(anonymous) =>
                                    updateDefaults({ anonymous })
                                }
                            />
                        </div>
                        <TimerSelect
                            label={t('Writing timer')}
                            value={defaults.timers.writing}
                            onChange={(writing) =>
                                updateDefaults({
                                    timers: { ...defaults.timers, writing },
                                })
                            }
                        />
                        <TimerSelect
                            label={t('Voting timer')}
                            value={defaults.timers.voting}
                            onChange={(voting) =>
                                updateDefaults({
                                    timers: { ...defaults.timers, voting },
                                })
                            }
                        />
                        <TimerSelect
                            label={t('Discussion timer')}
                            value={defaults.timers.discussing}
                            onChange={(discussing) =>
                                updateDefaults({
                                    timers: { ...defaults.timers, discussing },
                                })
                            }
                        />
                    </section>
                </div>
            </div>

            <footer className="flex flex-wrap items-center gap-2 border-t px-5 py-4">
                {mode === 'edit' && onDelete !== undefined && (
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setDeleting(true)}
                        className="text-skrum-destructive-text hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text"
                    >
                        <Trash2 aria-hidden="true" />
                        <span className="truncate">{t('Delete template')}</span>
                    </Button>
                )}
                <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
                    {visibleErrorCount > 0 && (
                        <p
                            role="status"
                            data-slot="template-error-summary"
                            className="min-w-0 text-sm text-skrum-destructive-text"
                        >
                            {visibleErrorCount === 1
                                ? t('1 field to fix')
                                : t(':count fields to fix', {
                                      count: visibleErrorCount,
                                  })}
                        </p>
                    )}
                    {onDuplicate !== undefined && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onDuplicate}
                        >
                            <span className="truncate">{t('Duplicate')}</span>
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={onCancel}>
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                    <Button type="submit" disabled={saving} aria-busy={saving}>
                        {saving && <Spinner aria-label={t('Loading')} />}
                        <span className="truncate">{t('Save')}</span>
                    </Button>
                </div>
            </footer>

            {onDelete !== undefined && (
                <ConfirmDialog
                    open={deleting}
                    onOpenChange={setDeleting}
                    tone="destructive"
                    title={t('Delete this template?')}
                    description={t(
                        'Retros already created from it are not affected.',
                    )}
                    confirmLabel={t('Delete template')}
                    onConfirm={async () => onDelete()}
                />
            )}
        </form>
    );
}
