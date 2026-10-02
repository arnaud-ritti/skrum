import { Link } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import IntegrationTargetsController from '@/actions/App/Http/Controllers/Integrations/IntegrationTargetsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { useActionItemMutationsValue } from '@/components/action-items/use-action-item-mutations';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type {
    ExportPreview,
    ExportSource,
    ExportTargetOption,
    ExportTargets,
    ExportWarning,
} from '@/types/integrations';

/** Several provider calls run in one export (spec §7): wait longer. */
const ExportTimeoutMs = 45_000;

const SearchDelayMs = 300;

/** Where the trackers of the item's team are configured. */
export type IntegrationScope = {
    workspace: string;
    /** Workspace managers get the link to the people mapping. */
    canManagePeople: boolean;
};

type Choice = {
    projectId: string | null;
    issueTypeId: string | null;
    teamId: string | null;
    repositoryId: string | null;
};

type Translate = ReturnType<typeof useTrans>['t'];

function assigneeLine(
    preview: ExportPreview,
    provider: string,
    t: Translate,
    isGitHub: boolean,
): string {
    const name = preview.assignee.displayName ?? '';

    switch (preview.assignee.state) {
        case 'mapped':
            return t('Assignee: :name (:provider)', { name, provider });
        case 'willMatch':
            return isGitHub
                ? t(
                      "Assignee: not mapped yet — skrum will use :name's GitHub sign-in",
                      { name },
                  )
                : t(
                      'Assignee: not mapped yet — skrum will try to match :name by email',
                      { name },
                  );
        case 'guest':
            return t('Unassigned (guest)');
        case 'never':
            return t('Unassigned (never assigned)');
        default:
            return t('Unassigned');
    }
}

function priorityLine(
    preview: ExportPreview,
    provider: string,
    t: Translate,
    isGitHub: boolean,
): string {
    const { name } = preview.priority;

    if (isGitHub) {
        return name === null
            ? t('No priority label')
            : t('Priority label: :label', { label: name });
    }

    return name === null
        ? t('Priority: :provider default', { provider })
        : t('Priority: :name', { name });
}

function withSelected(
    listed: ExportTargetOption[],
    selected: ExportTargetOption | null,
): ExportTargetOption[] {
    if (
        selected === null ||
        listed.some((option) => option.id === selected.id)
    ) {
        return listed;
    }

    return [selected, ...listed];
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
    const id = useId();

    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Select
                value={value ?? undefined}
                disabled={disabled || options.length === 0}
                onValueChange={onChange}
            >
                <SelectTrigger id={id} className="w-full" aria-label={label}>
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

function TargetSearch({
    label,
    value,
    disabled,
    loading,
    onChange,
}: {
    label: string;
    value: string;
    disabled: boolean;
    loading: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <Input
                value={value}
                maxLength={100}
                placeholder={label}
                aria-label={label}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
            {loading && <Spinner className="shrink-0" />}
        </div>
    );
}

type DialogProps = {
    item: ActionItem;
    source: ExportSource;
    scope: IntegrationScope;
    onClose: () => void;
};

export function ItemExportDialog({
    item,
    source,
    scope,
    onClose,
}: DialogProps): ReactElement {
    const { t } = useTrans();
    const { endpoints, run, onSaved } = useActionItemMutationsValue();
    const restoreFocus = useRestoreFocus(true);
    const [requestedProject, setRequestedProject] = useState<string | null>(
        null,
    );
    const [projectQuery, setProjectQuery] = useState('');
    const [searchedProjects, setSearchedProjects] = useState('');
    const [loadedRequest, setLoadedRequest] = useState<string | null>(null);
    const [targets, setTargets] = useState<ExportTargets | null>(null);
    const [selectedProject, setSelectedProject] =
        useState<ExportTargetOption | null>(null);
    const [selectedRepository, setSelectedRepository] =
        useState<ExportTargetOption | null>(null);
    const currentProject = useRef<string | null>(null);
    const [choice, setChoice] = useState<Choice>({
        projectId: null,
        issueTypeId: null,
        teamId: null,
        repositoryId: null,
    });
    const [preview, setPreview] = useState<ExportPreview | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const isJira = source.source === 'jira' || source.source === 'jira_dc';
    const isGitHub = source.source === 'github';
    const previewUrl = endpoints.exportPreview(item.id, source.source).url;
    const targetsRequest = `${requestedProject ?? ''}|${searchedProjects}`;
    const loadingTargets =
        loadedRequest !== targetsRequest ||
        projectQuery.trim() !== searchedProjects;

    useEffect(() => {
        const timer = setTimeout(
            () => setSearchedProjects(projectQuery.trim()),
            SearchDelayMs,
        );

        return () => clearTimeout(timer);
    }, [projectQuery]);

    useEffect(() => {
        let cancelled = false;
        const request = `${requestedProject ?? ''}|${searchedProjects}`;
        const projectId = requestedProject ?? currentProject.current;
        const query: Record<string, string> = {};

        if (projectId !== null) {
            query.project_id = projectId;
        }

        if (searchedProjects !== '') {
            query.q = searchedProjects;
        }

        retroRequest<ExportTargets>(
            IntegrationTargetsController.index(
                {
                    workspace: scope.workspace,
                    team: item.teamId,
                    integration: source.integrationId,
                },
                { query },
            ),
        )
            .then((loaded) => {
                if (cancelled) {
                    return;
                }

                const loadedProject = loaded.defaults.projectId ?? null;

                currentProject.current = loadedProject;
                setTargets(loaded);
                setSelectedProject(
                    (previous) =>
                        loaded.projects?.find(
                            (project) => project.id === loadedProject,
                        ) ?? (previous?.id === loadedProject ? previous : null),
                );
                setSelectedRepository(
                    (previous) =>
                        previous ??
                        loaded.repositories?.find(
                            (repository) =>
                                repository.id === loaded.defaults.repositoryId,
                        ) ??
                        null,
                );
                setChoice((previous) => ({
                    projectId: loadedProject,
                    issueTypeId:
                        previous.projectId === loadedProject &&
                        loaded.issueTypes?.some(
                            (type) => type.id === previous.issueTypeId,
                        )
                            ? previous.issueTypeId
                            : (loaded.defaults.issueTypeId ?? null),
                    teamId: loaded.defaults.teamId ?? null,
                    repositoryId:
                        previous.repositoryId ??
                        loaded.defaults.repositoryId ??
                        null,
                }));
                setLoadError(null);
                setLoadedRequest(request);
            })
            .catch((error: unknown) => {
                if (cancelled) {
                    return;
                }

                setLoadedRequest(request);
                setLoadError(
                    integrationErrorMessage(
                        error,
                        t('Could not reach :provider.', {
                            provider: source.label,
                        }),
                    ),
                );
            });

        return () => {
            cancelled = true;
        };
    }, [
        requestedProject,
        searchedProjects,
        scope.workspace,
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

    const hasTarget = isJira
        ? choice.projectId !== null && choice.issueTypeId !== null
        : isGitHub
          ? choice.repositoryId !== null
          : choice.teamId !== null;
    const ready = loadError === null && !loadingTargets && hasTarget;
    const listedProjects = targets?.projects ?? [];
    const projectOptions = withSelected(listedProjects, selectedProject);
    const listedRepositories = targets?.repositories ?? [];
    const repositoryOptions = withSelected(
        listedRepositories,
        selectedRepository,
    );
    const searchFoundNothing =
        !loadingTargets && loadError === null && searchedProjects !== '';

    const exportBody = (): Record<string, unknown> => {
        if (isJira) {
            return {
                source: source.source,
                project_id: choice.projectId,
                issue_type_id: choice.issueTypeId,
            };
        }

        if (isGitHub) {
            return {
                source: source.source,
                repository_id: choice.repositoryId,
            };
        }

        return { source: source.source, team_id: choice.teamId };
    };

    const submit = async (): Promise<void> => {
        if (!ready || busy) {
            return;
        }

        setBusy(true);

        try {
            const response = await run(
                retroRequest<{
                    actionItem: ActionItem;
                    warnings: ExportWarning[];
                }>(endpoints.exportItem(item.id), exportBody(), {
                    timeoutMs: ExportTimeoutMs,
                }),
            );

            if (!response) {
                return;
            }

            onSaved(response.actionItem);

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
                if (!open && !busy) {
                    onClose();
                }
            }}
        >
            <DialogContent onCloseAutoFocus={restoreFocus}>
                <DialogHeader>
                    <DialogTitle>
                        {t('Export to :provider', { provider: source.label })}
                    </DialogTitle>
                    <DialogDescription>
                        {t(
                            'Creates an issue with this action item and a link back to skrum. Later changes are not synced.',
                        )}
                    </DialogDescription>
                </DialogHeader>
                {loadError !== null && (
                    <Alert variant="error" title={loadError} />
                )}
                {loadError === null && targets === null && (
                    <div className="flex justify-center py-4">
                        <Spinner />
                    </div>
                )}
                {targets !== null && (
                    <div className="flex min-w-0 flex-col gap-3">
                        {isJira && (
                            <>
                                <TargetSearch
                                    label={t('Search projects')}
                                    value={projectQuery}
                                    disabled={busy}
                                    loading={loadingTargets}
                                    onChange={setProjectQuery}
                                />
                                {searchFoundNothing &&
                                    listedProjects.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            {t('No project found.')}
                                        </p>
                                    )}
                                <TargetSelect
                                    label={t('Project')}
                                    value={choice.projectId}
                                    options={projectOptions}
                                    disabled={busy || loadingTargets}
                                    onChange={setRequestedProject}
                                />
                                <TargetSelect
                                    label={t('Issue type')}
                                    value={choice.issueTypeId}
                                    options={targets.issueTypes ?? []}
                                    disabled={busy || loadingTargets}
                                    onChange={(issueTypeId) =>
                                        setChoice({ ...choice, issueTypeId })
                                    }
                                />
                            </>
                        )}
                        {isGitHub && (
                            <>
                                <TargetSearch
                                    label={t('Search repositories')}
                                    value={projectQuery}
                                    disabled={busy}
                                    loading={loadingTargets}
                                    onChange={setProjectQuery}
                                />
                                {searchFoundNothing &&
                                    listedRepositories.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            {t('No repository found.')}
                                        </p>
                                    )}
                                <TargetSelect
                                    label={t('Repository')}
                                    value={choice.repositoryId}
                                    options={repositoryOptions}
                                    disabled={busy || loadingTargets}
                                    onChange={(repositoryId) => {
                                        setSelectedRepository(
                                            repositoryOptions.find(
                                                (repository) =>
                                                    repository.id ===
                                                    repositoryId,
                                            ) ?? null,
                                        );
                                        setChoice({ ...choice, repositoryId });
                                    }}
                                />
                            </>
                        )}
                        {!isJira && !isGitHub && (
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
                    <ul
                        data-slot="item-export-preview"
                        className="flex min-w-0 flex-col gap-1 rounded-lg bg-muted p-3 text-sm text-muted-foreground"
                    >
                        <li className="break-words">
                            {assigneeLine(preview, source.label, t, isGitHub)}
                        </li>
                        <li className="break-words">
                            {priorityLine(preview, source.label, t, isGitHub)}
                        </li>
                    </ul>
                )}
                {scope.canManagePeople && (
                    <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto self-start justify-self-start px-0"
                    >
                        <Link
                            href={TeamIntegrationsController.index({
                                workspace: scope.workspace,
                                team: item.teamId,
                            })}
                        >
                            {t('Manage people')}
                        </Link>
                    </Button>
                )}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={onClose}
                    >
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                    <LoadingButton
                        type="button"
                        loading={busy}
                        disabled={!ready}
                        onClick={() => void submit()}
                    >
                        <span className="truncate">{t('Export')}</span>
                    </LoadingButton>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type Props = {
    item: ActionItem;
    sources: ExportSource[];
    scope: IntegrationScope;
};

/**
 * One entry per connected tracker the item was not exported to yet: an
 * item is exported at most once per provider (spec §3).
 */
export function ItemExport({
    item,
    sources,
    scope,
}: Props): ReactElement | null {
    const { t } = useTrans();
    const [chosen, setChosen] = useState<ExportSource | null>(null);
    const exported = new Set(
        (item.externalLinks ?? []).map((link) => link.source),
    );
    const available = sources.filter((source) => !exported.has(source.source));

    if (available.length === 0 && chosen === null) {
        return null;
    }

    const onlyLabel =
        available.length === 1
            ? t('Export to :provider', { provider: available[0].label })
            : '';

    return (
        <>
            {available.length === 1 && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="shrink-0"
                            aria-label={onlyLabel}
                            onClick={() => setChosen(available[0])}
                        >
                            <Upload aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{onlyLabel}</TooltipContent>
                </Tooltip>
            )}
            {available.length > 1 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="shrink-0"
                            aria-label={t('Export')}
                        >
                            <Upload aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {available.map((source) => (
                            <DropdownMenuItem
                                key={source.source}
                                onSelect={() => setChosen(source)}
                            >
                                {t('Export to :provider', {
                                    provider: source.label,
                                })}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {chosen !== null && (
                <ItemExportDialog
                    item={item}
                    source={chosen}
                    scope={scope}
                    onClose={() => setChosen(null)}
                />
            )}
        </>
    );
}
