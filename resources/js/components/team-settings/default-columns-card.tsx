import { router } from '@inertiajs/react';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import TeamDefaultRetroTemplatesController from '@/actions/App/Http/Controllers/TeamDefaultRetroTemplatesController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { columnColorClass } from '@/components/skrum/retro-template-picker';
import { MaxTemplateColumns } from '@/components/skrum/template-editor';
import { RetroColumnsEditor } from '@/components/teams/session-create/retro-columns-editor';
import { SettingsPanel } from '@/components/team-settings/settings-panel';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { newDraftColumnId, sameColumns } from '@/lib/retro/template-adapter';
import type { DraftColumn } from '@/lib/retro/template-adapter';
import {
    DefaultTemplateCategory,
    copyTemplateName,
} from '@/lib/workspaces/template-draft';
import type {
    CatalogueTemplate,
    TeamSummary,
    TeamTemplateUsageRow,
    TemplateColumn,
} from '@/types';

type DefaultColumnsCardProps = {
    workspaceSlug: string;
    team: TeamSummary;
    /** The team's default template. */
    template: TeamTemplateUsageRow;
};

type CataloguePage = { props: { catalogue?: CatalogueTemplate[] } };

function toDraft(columns: TemplateColumn[]): DraftColumn[] {
    return columns.map((column) => ({
        id: newDraftColumnId(),
        title: column.title,
        description: column.description,
        color: column.color,
    }));
}

function payloadColumns(
    columns: { title: string; description: string | null; color: string }[],
) {
    return columns.map(({ title, description, color }) => ({
        title,
        description: description ?? '',
        color,
    }));
}

/**
 * Default columns (ScreenSettings frame a): the columns of the team's
 * default template, edited in place by who may edit that template, read-only
 * with "Duplicate as a team template" otherwise.
 */
export function DefaultColumnsCard({
    workspaceSlug,
    team,
    template,
}: DefaultColumnsCardProps): ReactElement {
    const { t } = useTrans();
    const editable = template.canEdit && template.templateId !== null;
    const [columns, setColumns] = useState(() => toDraft(template.columns));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const changed = !sameColumns(columns, template.columns);
    const category = template.category ?? DefaultTemplateCategory;

    const save = (): void => {
        if (template.templateId === null || !changed || saving) {
            return;
        }

        router.patch(
            WorkspaceTemplatesController.update.url({
                workspace: workspaceSlug,
                template: template.templateId,
            }),
            {
                name: template.name,
                category,
                columns: payloadColumns(columns),
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onSuccess: () => setErrors({}),
                onError: (failures) => setErrors(failures),
                onFinish: () => setSaving(false),
            },
        );
    };

    const failDuplicate = (): void =>
        setErrors({ duplicate: t('Something went wrong. Please try again.') });

    const makeDefault = (name: string, page: CataloguePage): void => {
        const copy = page.props.catalogue?.find(
            (item) => item.isWorkspace && item.name === name,
        );

        if (copy === undefined) {
            failDuplicate();

            return;
        }

        router.put(
            TeamDefaultRetroTemplatesController.update.url({
                workspace: workspaceSlug,
                team: team.id,
            }),
            { template: copy.key },
            { preserveScroll: true },
        );
    };

    const duplicate = (): void => {
        const name = copyTemplateName(
            t('Copy of :name', { name: template.name }),
        );

        router.post(
            WorkspaceTemplatesController.store.url(workspaceSlug),
            {
                name,
                category,
                columns: payloadColumns(template.columns),
                visibility: 'team',
                team_id: team.id,
            },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onSuccess: () =>
                    router.reload({
                        only: ['catalogue'],
                        onSuccess: (page) =>
                            makeDefault(name, page as unknown as CataloguePage),
                        onError: failDuplicate,
                    }),
                onError: (failures) => setErrors(failures),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <SettingsPanel
            id="default-columns"
            title={t('Default columns · template “:name”', {
                name: template.name,
            })}
            footer={
                editable ? (
                    <LoadingButton
                        type="button"
                        size="sm"
                        loading={saving}
                        disabled={!changed}
                        onClick={save}
                        className="ml-auto max-w-full"
                    >
                        <span className="truncate">{t('Save')}</span>
                    </LoadingButton>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        onClick={duplicate}
                        className="ml-auto max-w-full"
                    >
                        <Copy aria-hidden />
                        <span className="truncate">
                            {t('Duplicate as a team template')}
                        </span>
                    </Button>
                )
            }
        >
            {editable ? (
                <RetroColumnsEditor
                    value={columns}
                    onChange={(next) => {
                        setColumns(next);
                        setErrors({});
                    }}
                    max={MaxTemplateColumns}
                    errors={errors}
                />
            ) : (
                <ul
                    aria-label={t('Columns')}
                    className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,--spacing(32)),1fr))] gap-2"
                >
                    {template.columns.map((column, index) => (
                        <li
                            key={index}
                            className={`flex min-w-0 items-center gap-2 rounded-md border border-(--col-border) bg-(--col) px-3 py-2.5 text-sm font-semibold text-(--col-text) ${columnColorClass(column.color)}`}
                        >
                            <span
                                aria-hidden
                                className="size-3.5 shrink-0 rounded-xs border border-(--col-border) bg-(--col)"
                            />
                            <span className="truncate">{column.title}</span>
                        </li>
                    ))}
                </ul>
            )}
            {!editable &&
                Object.entries(errors).map(([field, message]) => (
                    <p
                        key={field}
                        role="alert"
                        className="text-body-sm text-skrum-destructive-text"
                    >
                        {message}
                    </p>
                ))}
        </SettingsPanel>
    );
}
