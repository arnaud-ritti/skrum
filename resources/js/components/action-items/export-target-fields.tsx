import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import IntegrationTargetsController from '@/actions/App/Http/Controllers/Integrations/IntegrationTargetsController';
import { Alert } from '@/components/ui/alert';
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
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
import type {
    ExportSource,
    ExportTargetOption,
    ExportTargets,
    TrackerProviderKey,
} from '@/types/integrations';

const SearchDelayMs = 300;

/** Where the trackers of the item's team are configured. */
export type IntegrationScope = {
    workspace: string;
    /** Workspace managers get the link to the people mapping. */
    canManagePeople: boolean;
};

/** Where an export goes: the fields its tracker asks for, the others null. */
export type ExportTarget = {
    projectId: string | null;
    issueTypeId: string | null;
    teamId: string | null;
    repositoryId: string | null;
};

export const EmptyExportTarget: ExportTarget = {
    projectId: null,
    issueTypeId: null,
    teamId: null,
    repositoryId: null,
};

function isJiraSource(source: TrackerProviderKey): boolean {
    return source === 'jira' || source === 'jira_dc';
}

/** Whether the tracker has every field it needs to create an issue. */
export function exportTargetComplete(
    source: TrackerProviderKey,
    target: ExportTarget,
): boolean {
    if (isJiraSource(source)) {
        return target.projectId !== null && target.issueTypeId !== null;
    }

    if (source === 'github') {
        return target.repositoryId !== null;
    }

    return target.teamId !== null;
}

/** The body of the export endpoint for that tracker and target. */
export function exportTargetBody(
    source: TrackerProviderKey,
    target: ExportTarget,
): Record<string, unknown> {
    if (isJiraSource(source)) {
        return {
            source,
            project_id: target.projectId,
            issue_type_id: target.issueTypeId,
        };
    }

    if (source === 'github') {
        return { source, repository_id: target.repositoryId };
    }

    return { source, team_id: target.teamId };
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

type Props = {
    source: ExportSource;
    scope: IntegrationScope;
    /** The skrum team whose tracker settings and last choice apply. */
    teamId: string;
    value: ExportTarget;
    onChange: (value: ExportTarget) => void;
    disabled?: boolean;
    /** Told whether the targets are loaded and the target is complete. */
    onReadyChange?: (ready: boolean) => void;
};

/**
 * The target of an export: the Jira project (searched) and issue type, the
 * Linear team or the GitHub repository, starting from the team's last choice.
 */
export function ExportTargetFields({
    source,
    scope,
    teamId,
    value,
    onChange,
    disabled = false,
    onReadyChange,
}: Props): ReactElement {
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
    const [loadError, setLoadError] = useState<string | null>(null);
    const currentProject = useRef<string | null>(null);
    const latest = useRef({ value, onChange });
    const isJira = isJiraSource(source.source);
    const isGitHub = source.source === 'github';
    const targetsRequest = `${requestedProject ?? ''}|${searchedProjects}`;
    const loadingTargets =
        loadedRequest !== targetsRequest ||
        projectQuery.trim() !== searchedProjects;
    const ready =
        loadError === null &&
        !loadingTargets &&
        exportTargetComplete(source.source, value);

    useEffect(() => {
        latest.current = { value, onChange };
    });

    useEffect(() => {
        onReadyChange?.(ready);
    }, [ready, onReadyChange]);

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
                    team: teamId,
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
                const previous = latest.current.value;

                currentProject.current = loadedProject;
                setTargets(loaded);
                setSelectedProject(
                    (selected) =>
                        loaded.projects?.find(
                            (project) => project.id === loadedProject,
                        ) ?? (selected?.id === loadedProject ? selected : null),
                );
                setSelectedRepository(
                    (selected) =>
                        selected ??
                        loaded.repositories?.find(
                            (repository) =>
                                repository.id === loaded.defaults.repositoryId,
                        ) ??
                        null,
                );
                latest.current.onChange({
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
                });
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
        teamId,
        source.integrationId,
        source.label,
        t,
    ]);

    const listedProjects = targets?.projects ?? [];
    const projectOptions = withSelected(listedProjects, selectedProject);
    const listedRepositories = targets?.repositories ?? [];
    const repositoryOptions = withSelected(
        listedRepositories,
        selectedRepository,
    );
    const searchFoundNothing =
        !loadingTargets && loadError === null && searchedProjects !== '';

    return (
        <>
            {loadError !== null && <Alert variant="error" title={loadError} />}
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
                                disabled={disabled}
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
                                value={value.projectId}
                                options={projectOptions}
                                disabled={disabled || loadingTargets}
                                onChange={setRequestedProject}
                            />
                            <TargetSelect
                                label={t('Issue type')}
                                value={value.issueTypeId}
                                options={targets.issueTypes ?? []}
                                disabled={disabled || loadingTargets}
                                onChange={(issueTypeId) =>
                                    onChange({ ...value, issueTypeId })
                                }
                            />
                        </>
                    )}
                    {isGitHub && (
                        <>
                            <TargetSearch
                                label={t('Search repositories')}
                                value={projectQuery}
                                disabled={disabled}
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
                                value={value.repositoryId}
                                options={repositoryOptions}
                                disabled={disabled || loadingTargets}
                                onChange={(repositoryId) => {
                                    setSelectedRepository(
                                        repositoryOptions.find(
                                            (repository) =>
                                                repository.id === repositoryId,
                                        ) ?? null,
                                    );
                                    onChange({ ...value, repositoryId });
                                }}
                            />
                        </>
                    )}
                    {!isJira && !isGitHub && (
                        <TargetSelect
                            label={t('Linear team')}
                            value={value.teamId}
                            options={targets.teams ?? []}
                            disabled={disabled}
                            onChange={(linearTeamId) =>
                                onChange({ ...value, teamId: linearTeamId })
                            }
                        />
                    )}
                </div>
            )}
        </>
    );
}
