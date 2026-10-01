import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
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

const SearchDelayMs = 300;

type Choice = {
    projectId: string | null;
    issueTypeId: string | null;
    teamId: string | null;
    repositoryId: string | null;
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
    isGitHub: boolean,
): string {
    switch (preview.assignee.state) {
        case 'mapped':
            return t('Assignee: :name (:provider)', {
                name: preview.assignee.displayName ?? '',
                provider,
            });
        case 'willMatch':
            return isGitHub
                ? t(
                      "Assignee: not mapped yet — skrum will use :name's GitHub sign-in",
                      { name: preview.assignee.displayName ?? '' },
                  )
                : t(
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
                    workspace,
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
                if (!cancelled) {
                    setLoadedRequest(request);
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
        searchedProjects,
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

    const ready =
        loadError === null &&
        !loadingTargets &&
        (isJira
            ? choice.projectId !== null && choice.issueTypeId !== null
            : isGitHub
              ? choice.repositoryId !== null
              : choice.teamId !== null);
    const listedProjects = targets?.projects ?? [];
    const projectOptions =
        selectedProject === null ||
        listedProjects.some((project) => project.id === selectedProject.id)
            ? listedProjects
            : [selectedProject, ...listedProjects];
    const listedRepositories = targets?.repositories ?? [];
    const repositoryOptions =
        selectedRepository === null ||
        listedRepositories.some(
            (repository) => repository.id === selectedRepository.id,
        )
            ? listedRepositories
            : [selectedRepository, ...listedRepositories];

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
                : isGitHub
                  ? {
                        source: source.source,
                        repository_id: choice.repositoryId,
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
                {targets !== null && (
                    <div className="space-y-3">
                        {isJira ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={projectQuery}
                                        maxLength={100}
                                        placeholder={t('Search projects')}
                                        aria-label={t('Search projects')}
                                        disabled={busy}
                                        onChange={(event) =>
                                            setProjectQuery(event.target.value)
                                        }
                                    />
                                    {loadingTargets && <Spinner />}
                                </div>
                                {!loadingTargets &&
                                    loadError === null &&
                                    searchedProjects !== '' &&
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
                        ) : isGitHub ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={projectQuery}
                                        maxLength={100}
                                        placeholder={t('Search repositories')}
                                        aria-label={t('Search repositories')}
                                        disabled={busy}
                                        onChange={(event) =>
                                            setProjectQuery(event.target.value)
                                        }
                                    />
                                    {loadingTargets && <Spinner />}
                                </div>
                                {!loadingTargets &&
                                    searchedProjects !== '' &&
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
                        <li>
                            {assigneeLine(preview, source.label, t, isGitHub)}
                        </li>
                        <li>
                            {isGitHub
                                ? preview.priority.name === null
                                    ? t('No priority label')
                                    : t('Priority label: :label', {
                                          label: preview.priority.name,
                                      })
                                : preview.priority.name === null
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
