import { router } from '@inertiajs/react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { LayoutGrid, Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import TeamDefaultRetroTemplatesController from '@/actions/App/Http/Controllers/TeamDefaultRetroTemplatesController';
import {
    RetroTemplatePicker,
    columnColorClass,
} from '@/components/skrum/retro-template-picker';
import { SettingsPanel } from '@/components/team-settings/settings-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { TemplateEditorDialog } from '@/components/workspaces/template-editor-dialog';
import type { TemplateEditorTarget } from '@/components/workspaces/template-editor-dialog';
import { useTrans } from '@/hooks/use-trans';
import { toRetroTemplates } from '@/lib/retro/template-adapter';
import { blankTemplateDraft } from '@/lib/workspaces/template-draft';
import type {
    CatalogueTemplate,
    CategoryOption,
    TeamSummary,
    TeamTemplateUsageRow,
    TemplateColumn,
    WorkspaceSummary,
} from '@/types';

type RetroTemplatesCardProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    templates: TeamTemplateUsageRow[];
    /** The key of the team's default, while the viewer may still use it. */
    defaultTemplate: string | null;
    /** A default is set but nobody may use it any more. */
    defaultUnavailable: boolean;
    categories: CategoryOption[];
    /** Loaded on demand, for "Browse" and the editor's built-in starts. */
    catalogue?: CatalogueTemplate[];
};

/** The colours of a template's columns, in order (`st-tpl-sw`). */
export function TemplateColorStrip({ columns }: { columns: TemplateColumn[] }) {
    return (
        <span
            aria-hidden="true"
            data-slot="template-color-strip"
            className="flex shrink-0 gap-0.5"
        >
            {columns.map((column, index) => (
                <i
                    key={index}
                    className={`block h-5 w-2 rounded-xs border border-(--col-border) bg-(--col) ${columnColorClass(column.color)}`}
                />
            ))}
        </span>
    );
}

function TemplateRow({ template }: { template: TeamTemplateUsageRow }) {
    const { t } = useTrans();
    const radioId = useId();
    const nameId = useId();

    return (
        <label
            htmlFor={radioId}
            className="flex min-w-0 cursor-pointer flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 transition-colors duration-140 ease-standard has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-skrum-primary-soft motion-reduce:transition-none"
        >
            <RadioGroupItem
                id={radioId}
                value={template.key}
                aria-labelledby={nameId}
                // Radix checks a radio the arrow keys focus; each check saves
                // the default, so arrows only move and Space chooses.
                onFocus={(event) => event.preventDefault()}
            />
            <TemplateColorStrip columns={template.columns} />
            <span
                id={nameId}
                className="min-w-0 flex-1 truncate text-sm font-semibold"
            >
                {template.name}
            </span>
            {template.isDefault && <Badge variant="soft">{t('Default')}</Badge>}
            <span className="shrink-0 text-xs text-muted-foreground">
                {template.usageCount === 0
                    ? t('Never used')
                    : t('Used :count×', { count: template.usageCount })}
            </span>
        </label>
    );
}

/**
 * Retro templates (ScreenSettings frame a): the team's most used templates
 * and its default; choosing a radio makes it the default.
 */
export function RetroTemplatesCard({
    workspace,
    team,
    templates,
    defaultTemplate,
    defaultUnavailable,
    categories,
    catalogue,
}: RetroTemplatesCardProps): ReactElement {
    const { t } = useTrans();
    const [creating, setCreating] = useState<TemplateEditorTarget | null>(null);
    const [browsing, setBrowsing] = useState(false);
    const [picked, setPicked] = useState(defaultTemplate ?? '');
    const [error, setError] = useState<string>();
    const catalogueTemplates = useMemo(
        () => toRetroTemplates(catalogue ?? []),
        [catalogue],
    );

    const makeDefault = (key: string): void => {
        setError(undefined);

        router.put(
            TeamDefaultRetroTemplatesController.update.url({
                workspace: workspace.slug,
                team: team.id,
            }),
            { template: key },
            {
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        errors.template ??
                            t('Something went wrong. Please try again.'),
                    ),
            },
        );
    };

    const loadCatalogue = (): void => {
        if (catalogue === undefined) {
            router.reload({ only: ['catalogue'] });
        }
    };

    return (
        <SettingsPanel
            id="retro-templates"
            title={t('Retro templates')}
            actions={
                <div className="flex flex-wrap items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            loadCatalogue();
                            setCreating({
                                key: `team-template-${Date.now()}`,
                                template: null,
                                draft: blankTemplateDraft(),
                            });
                        }}
                    >
                        <Plus aria-hidden />
                        {t('Create')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            loadCatalogue();
                            setPicked(defaultTemplate ?? '');
                            setBrowsing(true);
                        }}
                    >
                        <LayoutGrid aria-hidden />
                        {t('Browse')}
                    </Button>
                </div>
            }
        >
            {defaultUnavailable && (
                <p
                    role="status"
                    className="text-body-sm text-skrum-warning-text"
                >
                    {t('This template is no longer available. Choose another.')}
                </p>
            )}
            <RadioGroupPrimitive.Root
                aria-label={t('Retro templates')}
                value={defaultTemplate ?? ''}
                onValueChange={makeDefault}
                className="flex min-w-0 flex-col gap-2"
            >
                {templates.map((template) => (
                    <TemplateRow key={template.key} template={template} />
                ))}
            </RadioGroupPrimitive.Root>
            {error !== undefined && (
                <p
                    role="alert"
                    className="text-body-sm text-skrum-destructive-text"
                >
                    {error}
                </p>
            )}

            <TemplateEditorDialog
                workspace={workspace}
                target={creating}
                categories={categories}
                catalogue={catalogue}
                teamId={team.id}
                onClose={() => setCreating(null)}
                onDuplicate={() => {}}
            />

            <Dialog open={browsing} onOpenChange={setBrowsing}>
                <DialogContent
                    closeLabel={t('Close')}
                    aria-describedby={undefined}
                    className="sm:max-w-4xl"
                >
                    <DialogHeader>
                        <DialogTitle>{t('Retro templates')}</DialogTitle>
                    </DialogHeader>
                    <RetroTemplatePicker
                        value={picked}
                        onValueChange={setPicked}
                        templates={catalogueTemplates}
                        categories={categories}
                        loading={catalogue === undefined}
                        onUse={(key) => {
                            setBrowsing(false);
                            makeDefault(key);
                        }}
                        shortcuts={false}
                    />
                </DialogContent>
            </Dialog>
        </SettingsPanel>
    );
}
