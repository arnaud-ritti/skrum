import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import ConfirmFormDialog from '@/components/confirm-form-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import {
    columnColors,
    useColumnColorName,
} from '@/components/skrum/column-color-picker';
import { TemplateChips } from '@/components/templates/template-chips';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { ColumnColor } from '@/lib/retro/types';
import type {
    CatalogueTemplate,
    CategoryOption,
    TemplateCategory,
    TemplateColumn,
    WorkspaceSummary,
    WorkspaceTemplateSummary,
} from '@/types';

const MaxColumns = 10;

type Props = {
    workspace: WorkspaceSummary;
    templates: WorkspaceTemplateSummary[];
    categories: CategoryOption[];
    canManage: boolean;
    catalogue?: CatalogueTemplate[];
};

type ColumnDraft = { title: string; description: string; color: ColumnColor };

type TemplateForm = {
    name: string;
    category: TemplateCategory;
    columns: ColumnDraft[];
};

function toDraft(column: TemplateColumn): ColumnDraft {
    return {
        title: column.title,
        description: column.description ?? '',
        color: column.color,
    };
}

export default function WorkspaceTemplates({
    workspace,
    templates,
    categories,
    canManage,
    catalogue,
}: Props) {
    const { t } = useTrans();
    const [editing, setEditing] = useState<{
        template: WorkspaceTemplateSummary | null;
    } | null>(null);
    const categoryLabel = (value: string) =>
        categories.find((category) => category.value === value)?.label ?? value;

    return (
        <>
            <Head title={t('Templates')} />
            <div className="max-w-3xl space-y-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title={t('Templates')}
                        description={t(
                            'Templates shared by every team of this workspace',
                        )}
                    />
                    {canManage && (
                        <Button onClick={() => setEditing({ template: null })}>
                            <Plus />
                            {t('New template')}
                        </Button>
                    )}
                </div>

                {templates.length === 0 && (
                    <p className="text-muted-foreground">
                        {t('No workspace templates yet.')}
                    </p>
                )}

                {templates.length > 0 && (
                    <ul className="divide-y rounded-md border">
                        {templates.map((template) => (
                            <li key={template.id} className="space-y-2 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate font-medium">
                                            {template.name}
                                        </span>
                                        <Badge variant="secondary">
                                            {categoryLabel(template.category)}
                                        </Badge>
                                    </div>
                                    {canManage && (
                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setEditing({ template })
                                                }
                                            >
                                                {t('Edit')}
                                            </Button>
                                            <ConfirmFormDialog
                                                form={WorkspaceTemplatesController.destroy.form(
                                                    {
                                                        workspace:
                                                            workspace.slug,
                                                        template: template.id,
                                                    },
                                                )}
                                                title={t(
                                                    'Delete this template?',
                                                )}
                                                description={t(
                                                    'Retrospectives created from it keep their columns.',
                                                )}
                                                confirmLabel={t('Delete')}
                                                trigger={
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                    >
                                                        {t('Delete')}
                                                    </Button>
                                                }
                                            />
                                        </div>
                                    )}
                                </div>
                                <TemplateChips columns={template.columns} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {editing && (
                <TemplateEditor
                    key={editing.template?.id ?? 'new'}
                    workspace={workspace}
                    template={editing.template}
                    categories={categories}
                    catalogue={catalogue}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}

type EditorProps = {
    workspace: WorkspaceSummary;
    template: WorkspaceTemplateSummary | null;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
    onClose: () => void;
};

function TemplateEditor({
    workspace,
    template,
    categories,
    catalogue,
    onClose,
}: EditorProps) {
    const { t } = useTrans();
    const colorName = useColumnColorName();
    const form = useForm<TemplateForm>({
        name: template?.name ?? '',
        category: template?.category ?? 'essentials',
        columns: template?.columns.map(toDraft) ?? [
            { title: '', description: '', color: 'moss' },
        ],
    });
    const errors = form.errors as Record<string, string | undefined>;
    const builtIns = (catalogue ?? []).filter(
        (item) => !item.isWorkspace && item.columns.length > 0,
    );

    useEffect(() => {
        if (template === null && catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    }, [template, catalogue]);

    const setColumn = (index: number, change: Partial<ColumnDraft>) =>
        form.setData(
            'columns',
            form.data.columns.map((column, position) =>
                position === index ? { ...column, ...change } : column,
            ),
        );

    const moveColumn = (index: number, offset: -1 | 1) => {
        const columns = [...form.data.columns];
        [columns[index], columns[index + offset]] = [
            columns[index + offset],
            columns[index],
        ];
        form.setData('columns', columns);
    };

    const removeColumn = (index: number) =>
        form.setData(
            'columns',
            form.data.columns.filter((_, position) => position !== index),
        );

    const addColumn = () =>
        form.setData('columns', [
            ...form.data.columns,
            {
                title: '',
                description: '',
                color: columnColors[
                    form.data.columns.length % columnColors.length
                ],
            },
        ]);

    const startFrom = (key: string) => {
        const source = builtIns.find((item) => item.key === key);

        if (!source) {
            return;
        }

        form.setData({
            name: form.data.name || source.name,
            category: source.category ?? 'essentials',
            columns: source.columns.map(toDraft),
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: onClose };

        if (template) {
            form.submit(
                WorkspaceTemplatesController.update({
                    workspace: workspace.slug,
                    template: template.id,
                }),
                options,
            );

            return;
        }

        form.submit(
            WorkspaceTemplatesController.store(workspace.slug),
            options,
        );
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                aria-describedby={undefined}
                className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
            >
                <form onSubmit={submit} className="space-y-4">
                    <DialogTitle>
                        {template ? t('Edit template') : t('New template')}
                    </DialogTitle>

                    {template === null && builtIns.length > 0 && (
                        <div className="grid gap-2">
                            <Label htmlFor="template-source">
                                {t('Start from a built-in template')}
                            </Label>
                            <Select onValueChange={startFrom}>
                                <SelectTrigger id="template-source">
                                    <SelectValue
                                        placeholder={t(
                                            'Start from a built-in template',
                                        )}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {builtIns.map((item) => (
                                        <SelectItem
                                            key={item.key}
                                            value={item.key}
                                        >
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                            <Label htmlFor="template-name">{t('Name')}</Label>
                            <Input
                                id="template-name"
                                value={form.data.name}
                                maxLength={80}
                                required
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                            />
                            <InputError message={errors.name} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="template-category">
                                {t('Category')}
                            </Label>
                            <Select
                                value={form.data.category}
                                onValueChange={(value) =>
                                    form.setData(
                                        'category',
                                        value as TemplateCategory,
                                    )
                                }
                            >
                                <SelectTrigger id="template-category">
                                    <SelectValue />
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
                            <InputError message={errors.category} />
                        </div>
                    </div>

                    <fieldset className="space-y-3">
                        <legend className="text-sm font-medium">
                            {t('Columns')}
                        </legend>
                        {form.data.columns.map((column, index) => (
                            <div
                                key={index}
                                className="space-y-2 rounded-md border p-3"
                            >
                                <div className="flex items-start gap-2">
                                    <Input
                                        value={column.title}
                                        maxLength={100}
                                        required
                                        aria-label={t('Column title')}
                                        placeholder={t('Column title')}
                                        onChange={(event) =>
                                            setColumn(index, {
                                                title: event.target.value,
                                            })
                                        }
                                    />
                                    <Select
                                        value={column.color}
                                        onValueChange={(value) =>
                                            setColumn(index, {
                                                color: value as ColumnColor,
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-32"
                                            aria-label={t('Color')}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {columnColors.map((color) => (
                                                <SelectItem
                                                    key={color}
                                                    value={color}
                                                >
                                                    {colorName(color)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Move up')}
                                        disabled={index === 0}
                                        onClick={() => moveColumn(index, -1)}
                                    >
                                        <ArrowUp />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Move down')}
                                        disabled={
                                            index ===
                                            form.data.columns.length - 1
                                        }
                                        onClick={() => moveColumn(index, 1)}
                                    >
                                        <ArrowDown />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        aria-label={t('Remove column')}
                                        disabled={
                                            form.data.columns.length === 1
                                        }
                                        onClick={() => removeColumn(index)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                                <Textarea
                                    value={column.description}
                                    maxLength={200}
                                    rows={2}
                                    aria-label={t('Description')}
                                    placeholder={t('Description (optional)')}
                                    onChange={(event) =>
                                        setColumn(index, {
                                            description: event.target.value,
                                        })
                                    }
                                />
                                <InputError
                                    message={
                                        errors[`columns.${index}.title`] ??
                                        errors[
                                            `columns.${index}.description`
                                        ] ??
                                        errors[`columns.${index}.color`]
                                    }
                                />
                            </div>
                        ))}
                        <InputError message={errors.columns} />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={form.data.columns.length >= MaxColumns}
                            onClick={addColumn}
                        >
                            <Plus />
                            {t('Add column')}
                        </Button>
                    </fieldset>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {t('Save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
