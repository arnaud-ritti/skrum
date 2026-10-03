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
    TriangleAlert,
    User,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import {
    ColumnColorPicker,
    columnColors,
} from '@/components/skrum/column-color-picker';
import type { ColumnColor } from '@/components/skrum/column-color-picker';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
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
import { isEditableTarget } from '@/hooks/use-shortcut';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type { ColumnColor } from '@/components/skrum/column-color-picker';

export type TemplateVisibility = 'personal' | 'team' | 'workspace';

export type TemplatePhase = 'writing' | 'voting' | 'discussing';

export type TemplateColumnDraft = {
    id: string;
    title: string;
    description?: string | null;
    color: ColumnColor;
};

export type TemplateDefaults = {
    votesPerPerson: number;
    maxPerCard: number;
    anonymous: boolean;
    timers: Partial<Record<TemplatePhase, number>>;
};

/**
 * `name`, `category`, `columns`, `visibility` and `teamId` are what
 * WorkspaceTemplateRequest stores; `description` and `defaults` have no back
 * end yet. The optional fields are rendered only when the draft carries them.
 */
export type TemplateDraft = {
    name: string;
    category?: string;
    description?: string;
    visibility?: TemplateVisibility;
    /** The team of a team template. */
    teamId?: string | null;
    columns: TemplateColumnDraft[];
    defaults?: TemplateDefaults;
};

/**
 * Server validation errors by field, as Laravel returns them: `name`,
 * `category`, `columns`, `columns.N.title`, `columns.N.description`,
 * `columns.N.color`.
 */
export type TemplateEditorErrors = Record<string, string | undefined>;

export type TemplateCategoryOption = { value: string; label: string };

export type TemplateStartOption = { key: string; name: string };

export type TemplateTeamOption = { id: string; name: string };

export type TemplateEditorProps = {
    mode: 'create' | 'edit';
    value: TemplateDraft;
    onChange: (draft: TemplateDraft) => void;
    errors?: TemplateEditorErrors;
    categories?: TemplateCategoryOption[];
    colors?: readonly ColumnColor[];
    startFrom?: TemplateStartOption[];
    onStartFrom?: (key: string) => void;
    canShareWorkspace?: boolean;
    /** The teams the person may create team templates for; empty disables "Team". */
    teams?: TemplateTeamOption[];
    meta?: { editedBy: string; editedAt: string; usedByTeams?: number };
    saving?: boolean;
    onSave: () => void;
    onCancel: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    /** DOM ids of the controls. Defaults: `template-name`, `template-source`, `template-category`. */
    ids?: { name?: string; source?: string; category?: string; team?: string };
    className?: string;
};

export const MaxTemplateColumns = 10;
export const MaxTemplateNameLength = 80;
export const MaxColumnTitleLength = 100;
export const MaxColumnDescriptionLength = 200;

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

export function firstFreeColor(
    columns: TemplateColumnDraft[],
    colors: readonly ColumnColor[] = columnColors,
): ColumnColor {
    const used = new Set(columns.map((column) => column.color));

    return (
        colors.find((color) => !used.has(color)) ??
        colors[columns.length % colors.length]
    );
}

/**
 * The single other column that holds `color`, when there is exactly one:
 * only then does picking that colour swap the two. With more columns than
 * colours several columns share a colour, and picking it just sets it.
 */
function soleOwner(
    columns: TemplateColumnDraft[],
    index: number,
    color: ColumnColor,
): number | null {
    const owners = columns
        .map((column, position) => (column.color === color ? position : -1))
        .filter((position) => position >= 0 && position !== index);

    return owners.length === 1 ? owners[0] : null;
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

    const owner = soleOwner(columns, index, color);

    return columns.map((column, position) => {
        if (position === index) {
            return { ...column, color };
        }

        if (position === owner) {
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

function FieldWarning({ id, message }: { id: string; message?: string }) {
    if (message === undefined) {
        return null;
    }

    return (
        <p
            id={id}
            role="status"
            data-slot="template-column-warning"
            className="flex items-start gap-1 text-xs text-skrum-warning-text"
        >
            <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-3 shrink-0"
            />
            <span className="min-w-0">{message}</span>
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
    colors: readonly ColumnColor[];
    usedBy: Partial<Record<ColumnColor, string>>;
    error?: string;
    /** Shown under the title without marking the field invalid. */
    warning?: string;
    descriptionError?: string;
    colorError?: string;
    canDelete: boolean;
    registerTitle: (id: string, node: HTMLInputElement | null) => void;
    onTitleChange: (title: string) => void;
    onTitleBlur: () => void;
    onDescriptionChange: (description: string) => void;
    onColorChange: (color: ColumnColor) => void;
    onDelete: () => void;
};

function SortableColumnRow(props: RowProps) {
    const { t } = useTrans();
    const { column, index, total, error, canDelete } = props;
    const warning = error === undefined ? props.warning : undefined;
    const { descriptionError, colorError } = props;
    const errorId = useId();
    const warningId = useId();
    const descriptionErrorId = useId();
    const invalid =
        error !== undefined ||
        descriptionError !== undefined ||
        colorError !== undefined;
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
        if (event.key !== 'Delete' || !canDelete || event.defaultPrevented) {
            return;
        }

        if (
            !(event.target instanceof Node) ||
            !event.currentTarget.contains(event.target)
        ) {
            return;
        }

        if (isEditableTarget(event.target)) {
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
            aria-invalid={invalid ? true : undefined}
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
                colors={props.colors}
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
                aria-describedby={
                    error === undefined
                        ? warning === undefined
                            ? undefined
                            : warningId
                        : errorId
                }
                placeholder={t('Column title')}
                maxLength={MaxColumnTitleLength}
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
                value={column.description ?? ''}
                aria-label={t('Column :position help question', {
                    position: index + 1,
                })}
                placeholder={t('Help question (optional)')}
                maxLength={MaxColumnDescriptionLength}
                aria-invalid={descriptionError === undefined ? undefined : true}
                aria-describedby={
                    descriptionError === undefined
                        ? undefined
                        : descriptionErrorId
                }
                onChange={(event) =>
                    props.onDescriptionChange(event.target.value)
                }
                className="col-span-2 col-start-3 h-7 text-xs"
            />
            {(invalid || warning !== undefined) && (
                <div className="col-span-2 col-start-3 flex flex-col gap-1">
                    <FieldError id={errorId} message={error} />
                    <FieldWarning id={warningId} message={warning} />
                    <FieldError
                        id={descriptionErrorId}
                        message={descriptionError}
                    />
                    <FieldError id={`${errorId}-color`} message={colorError} />
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
                                    'size-2.5 shrink-0 rounded-full bg-(--col-border)',
                                    columnColorClass(column.color),
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
    categories,
    colors = columnColors,
    startFrom,
    onStartFrom,
    canShareWorkspace = true,
    teams,
    meta,
    saving = false,
    onSave,
    onCancel,
    onDuplicate,
    onDelete,
    ids,
    className,
}: TemplateEditorProps) {
    const { t } = useTrans();
    const headingId = useId();
    const nameId = ids?.name ?? 'template-name';
    const nameErrorId = useId();
    const descriptionId = useId();
    const visibilityHelpId = useId();
    const categoryId = ids?.category ?? 'template-category';
    const categoryErrorId = useId();
    const teamId = ids?.team ?? 'template-team';
    const teamErrorId = useId();
    const startFromId = ids?.source ?? 'template-source';
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

    /** "Team" keeps a team the person may choose, else the first of the list. */
    const chooseVisibility = (next: TemplateVisibility): void => {
        const current = latest.current.teamId;

        if (
            next !== 'team' ||
            teams === undefined ||
            teams.some((team) => team.id === current)
        ) {
            update({ visibility: next });

            return;
        }

        update({ visibility: next, teamId: teams[0]?.id ?? null });
    };

    const updateDefaults = (patch: Partial<TemplateDefaults>) => {
        const current = latest.current.defaults;

        if (current === undefined) {
            return;
        }

        update({ defaults: { ...current, ...patch } });
    };

    const problems = findColumnProblems(value.columns);
    const nameProblem = value.name.trim() === '';

    const hasBlockingProblem = Object.values(problems).some(
        (problem) => problem.kind === 'empty',
    );

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

        if (problem?.kind !== 'empty') {
            return undefined;
        }

        if (submitted || touched.has(value.columns[index].id)) {
            return t('Give this column a title.');
        }

        return undefined;
    };

    /** The server accepts two columns with the same title: say it, never block. */
    const columnWarning = (index: number): string | undefined => {
        const problem = problems[index];

        if (problem?.kind !== 'duplicate') {
            return undefined;
        }

        if (submitted || touched.has(value.columns[index].id)) {
            return t('Another column is already called “:title”.', {
                title: problem.otherTitle,
            });
        }

        return undefined;
    };

    const serverColumnError = (
        index: number,
        field: 'description' | 'color',
    ): string | undefined => errors?.[`columns.${index}.${field}`];

    const categoryError =
        categories === undefined ? undefined : errors?.category;
    const columnsError = errors?.columns;
    const showsTeamSelect =
        value.visibility === 'team' && teams !== undefined && teams.length > 1;
    const teamError = showsTeamSelect ? errors?.team_id : undefined;

    const visibleErrorCount =
        (nameError === undefined ? 0 : 1) +
        (categoryError === undefined ? 0 : 1) +
        (teamError === undefined ? 0 : 1) +
        (columnsError === undefined ? 0 : 1) +
        value.columns.reduce(
            (count, _, index) =>
                count +
                [
                    columnError(index),
                    serverColumnError(index, 'description'),
                    serverColumnError(index, 'color'),
                ].filter((message) => message !== undefined).length,
            0,
        );

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
                problems[position]?.kind === 'empty' ||
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

        const hasLocalProblem = nameProblem || hasBlockingProblem;

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
            color: firstFreeColor(value.columns, colors),
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

        for (const color of colors) {
            const owner = soleOwner(value.columns, index, color);

            if (owner === null) {
                continue;
            }

            const title = value.columns[owner].title;

            used[color] = title.trim() === '' ? t('Untitled') : title;
        }

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
        {
            value: 'team',
            label: t('Team'),
            icon: Users,
            disabled: teams !== undefined && teams.length === 0,
        },
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
    const { defaults, visibility } = value;
    const VisibilityIcon =
        visibility === undefined ? undefined : visibilityIcons[visibility];
    const canStartFrom =
        mode === 'create' &&
        onStartFrom !== undefined &&
        startFrom !== undefined &&
        startFrom.length > 0;

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
                    {visibility !== undefined && (
                        <Badge variant="muted" icon={VisibilityIcon}>
                            {visibilityLabels[visibility]}
                        </Badge>
                    )}
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
                    {canStartFrom && (
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor={startFromId}
                                className="text-sm font-medium"
                            >
                                {t('Start from a built-in template')}
                            </label>
                            <Select onValueChange={onStartFrom}>
                                <SelectTrigger
                                    id={startFromId}
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t('Choose a template')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {startFrom.map((option) => (
                                        <SelectItem
                                            key={option.key}
                                            value={option.key}
                                        >
                                            {option.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={nameId} className="text-sm font-medium">
                            {t('Name')}
                        </label>
                        <Input
                            id={nameId}
                            ref={nameRef}
                            value={value.name}
                            maxLength={MaxTemplateNameLength}
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

                    {categories !== undefined && (
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor={categoryId}
                                className="text-sm font-medium"
                            >
                                {t('Category')}
                            </label>
                            <Select
                                value={value.category ?? ''}
                                onValueChange={(category) =>
                                    update({ category })
                                }
                            >
                                <SelectTrigger
                                    id={categoryId}
                                    className="w-full"
                                    aria-invalid={
                                        categoryError === undefined
                                            ? undefined
                                            : true
                                    }
                                    aria-describedby={
                                        categoryError === undefined
                                            ? undefined
                                            : categoryErrorId
                                    }
                                >
                                    <SelectValue
                                        placeholder={t('Choose a category')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((category) => (
                                        <SelectItem
                                            key={category.value}
                                            value={category.value}
                                        >
                                            {category.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError
                                id={categoryErrorId}
                                message={categoryError}
                            />
                        </div>
                    )}

                    {value.description !== undefined && (
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
                    )}

                    {visibility !== undefined && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">
                                {t('Visibility')}
                            </span>
                            <ToggleGroup
                                type="single"
                                variant="segmented"
                                fullWidth
                                aria-label={t('Visibility')}
                                value={visibility}
                                options={visibilityOptions}
                                onValueChange={chooseVisibility}
                                className="grid grid-cols-3"
                            />
                            <p
                                id={visibilityHelpId}
                                className="text-xs text-muted-foreground"
                            >
                                {canShareWorkspace
                                    ? visibilityHelp[visibility]
                                    : t(
                                          'Only workspace admins can share templates with the whole workspace.',
                                      )}
                            </p>
                        </div>
                    )}

                    {showsTeamSelect && (
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor={teamId}
                                className="text-sm font-medium"
                            >
                                {t('Team')}
                            </label>
                            <Select
                                value={value.teamId ?? ''}
                                onValueChange={(next) =>
                                    update({ teamId: next })
                                }
                            >
                                <SelectTrigger
                                    id={teamId}
                                    className="w-full"
                                    aria-invalid={
                                        teamError === undefined
                                            ? undefined
                                            : true
                                    }
                                    aria-describedby={
                                        teamError === undefined
                                            ? undefined
                                            : teamErrorId
                                    }
                                >
                                    <SelectValue
                                        placeholder={t('Choose a team')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {teams.map((team) => (
                                        <SelectItem
                                            key={team.id}
                                            value={team.id}
                                        >
                                            {team.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError id={teamErrorId} message={teamError} />
                        </div>
                    )}

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
                                            colors={colors}
                                            usedBy={usedByFor(index)}
                                            error={columnError(index)}
                                            warning={columnWarning(index)}
                                            descriptionError={serverColumnError(
                                                index,
                                                'description',
                                            )}
                                            colorError={serverColumnError(
                                                index,
                                                'color',
                                            )}
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
                                            onDescriptionChange={(
                                                description,
                                            ) =>
                                                patchColumn(index, {
                                                    description,
                                                })
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
                                                'size-4.5 shrink-0 rounded-full bg-(--col-border)',
                                                columnColorClass(
                                                    activeColumn.color,
                                                ),
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
                        <FieldError
                            id={`${headingId}-columns-error`}
                            message={columnsError}
                        />
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

                    {defaults !== undefined && (
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
                                        timers: {
                                            ...defaults.timers,
                                            discussing,
                                        },
                                    })
                                }
                            />
                        </section>
                    )}
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
