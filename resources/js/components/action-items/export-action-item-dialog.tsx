import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import IntegrationTargetsController from '@/actions/App/Http/Controllers/Integrations/IntegrationTargetsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type {
    ExportPreview,
    ExportSource,
    ExportTargetOption,
    ExportTargets,
    ExportWarning,
} from '@/types';
import type { RunMutation } from './action-item-card';

/** Several provider calls run in one export (spec §7): wait longer. */
const ExportTimeoutMs = 45_000;

type Choice = {
    projectId: string | null;
    issueTypeId: string | null;
    teamId: string | null;
};

type Translate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

type Props = {
    item: ActionItem;
    source: ExportSource;
    workspace: string;
    canManagePeople: boolean;
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    onClose: () => void;
    onExported: (item: ActionItem) => void;
};

function assigneeLine(
    preview: ExportPreview,
    provider: string,
    t: Translate,
): string {
    switch (preview.assignee.state) {
        case 'mapped':
            return t('Assignee: :name (:provider)', {
                name: preview.assignee.displayName ?? '',
                provider,
            });
        case 'willMatch':
            return t(
                'Assignee: not mapped yet — skrum will try to match :name by email',
                { name: preview.assignee.displayName ?? '' },
            );
        case 'guest':
            return t('Unassigned (guest)');
        case 'never':
            return t('Unassigned (never assigned)');
        default:
            return t('Unassigned');
    }
}

function TargetSelect({
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    label: string;
    value: string | null;
    options: ExportTargetOption[];
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-1">
            <p className="text-sm font-medium">{label}</p>
            <Select
                value={value ?? undefined}
                disabled={disabled || options.length === 0}
                onValueChange={onChange}
            >
                <SelectTrigger className="w-full" aria-label={label}>
                    <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            {option.key
                                ? `${option.key} — ${option.name}`
                                : option.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export function ExportActionItemDialog({
    item,
    source,
    workspace,
    canManagePeople,
    endpoints,
    run,
    onClose,
    onExported,
}: Props) {
    const { t } = useTrans();
    const [requestedProject, setRequestedProject] = useState<string | null>(
        null,
    );
    const [targets, setTargets] = useState<ExportTargets | null>(null);
    const [choice, setChoice] = useState<Choice>({
        projectId: null,
        issueTypeId: null,
        teamId: null,
    });
    const [preview, setPreview] = useState<ExportPreview | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const isJira = source.source === 'jira';
    const previewUrl = endpoints.exportPreview(item.id, source.source).url;

    useEffect(() => {
        let cancelled = false;

        retroRequest<ExportTargets>(
            IntegrationTargetsController.index(
                {
                    workspace,
                    team: item.teamId,
                    integration: source.integrationId,
                },
                requestedProject === null
                    ? undefined
                    : { query: { project_id: requestedProject } },
            ),
        )
            .then((loaded) => {
                if (cancelled) {
                    return;
                }

                setTargets(loaded);
                setChoice({
                    projectId: loaded.defaults.projectId ?? null,
                    issueTypeId: loaded.defaults.issueTypeId ?? null,
                    teamId: loaded.defaults.teamId ?? null,
                });
                setLoadError(null);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setLoadError(
                        integrationErrorMessage(
                            error,
                            t('Could not reach :provider.', {
                                provider: source.label,
                            }),
                        ),
                    );
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        requestedProject,
        workspace,
        item.teamId,
        source.integrationId,
        source.label,
        t,
    ]);

    useEffect(() => {
        let cancelled = false;

        retroRequest<ExportPreview>({ url: previewUrl, method: 'get' })
            .then((loaded) => {
                if (!cancelled) {
                    setPreview(loaded);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPreview(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [previewUrl, item.assignee?.id, item.priority]);

    const ready = isJira
        ? choice.projectId !== null && choice.issueTypeId !== null
        : choice.teamId !== null;

    const submit = async () => {
        if (!ready || busy) {
            return;
        }

        setBusy(true);

        try {
            const body = isJira
                ? {
                      source: source.source,
                      project_id: choice.projectId,
                      issue_type_id: choice.issueTypeId,
                  }
                : { source: source.source, team_id: choice.teamId };
            const response = await run(
                retroRequest<{
                    actionItem: ActionItem;
                    warnings: ExportWarning[];
                }>(endpoints.exportItem(item.id), body, {
                    timeoutMs: ExportTimeoutMs,
                }),
            );

            if (!response) {
                return;
            }

            onExported(response.actionItem);

            const link = response.actionItem.externalLinks?.find(
                (candidate) => candidate.source === source.source,
            );

            toast.success(t('Exported as :key.', { key: link?.key ?? '' }));

            for (const warning of response.warnings) {
                if (warning.message !== null) {
                    toast.warning(warning.message);
                }
            }

            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogTitle>
                    {t('Export to :provider', { provider: source.label })}
                </DialogTitle>
                <DialogDescription>
                    {t(
                        'Creates an issue with this action item and a link back to skrum. Later changes are not synced.',
                    )}
                </DialogDescription>
                {loadError !== null && (
                    <p className="text-sm text-destructive">{loadError}</p>
                )}
                {loadError === null && targets === null && (
                    <div className="flex justify-center py-4">
                        <Spinner />
                    </div>
                )}
                {loadError === null && targets !== null && (
                    <div className="space-y-3">
                        {isJira ? (
                            <>
                                <TargetSelect
                                    label={t('Project')}
                                    value={choice.projectId}
                                    options={targets.projects ?? []}
                                    disabled={busy}
                                    onChange={setRequestedProject}
                                />
                                <TargetSelect
                                    label={t('Issue type')}
                                    value={choice.issueTypeId}
                                    options={targets.issueTypes ?? []}
                                    disabled={busy}
                                    onChange={(issueTypeId) =>
                                        setChoice({ ...choice, issueTypeId })
                                    }
                                />
                            </>
                        ) : (
                            <TargetSelect
                                label={t('Linear team')}
                                value={choice.teamId}
                                options={targets.teams ?? []}
                                disabled={busy}
                                onChange={(teamId) =>
                                    setChoice({ ...choice, teamId })
                                }
                            />
                        )}
                    </div>
                )}
                {preview !== null && (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>{assigneeLine(preview, source.label, t)}</li>
                        <li>
                            {preview.priority.name === null
                                ? t('Priority: :provider default', {
                                      provider: source.label,
                                  })
                                : t('Priority: :name', {
                                      name: preview.priority.name,
                                  })}
                        </li>
                    </ul>
                )}
                {canManagePeople && (
                    <Link
                        href={TeamIntegrationsController.index({
                            workspace,
                            team: item.teamId,
                        })}
                        className="text-sm underline"
                    >
                        {t('Manage people')}
                    </Link>
                )}
                <DialogFooter className="gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button
                        disabled={!ready || busy}
                        onClick={() => void submit()}
                    >
                        {busy && <Spinner />}
                        {t('Export')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
