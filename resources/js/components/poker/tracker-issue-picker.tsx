import { Check, ChevronsUpDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    useCommandListId,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
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
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import {
    importTerms,
    selectionLabel,
    toggleAll,
} from '@/lib/poker/tracker-browse';
import type {
    TrackerBrowseApi,
    TrackerPreview,
} from '@/lib/poker/tracker-browse';
import { TrackerLabels } from '@/lib/poker/types';
import type {
    PokerTrackerSource,
    TrackerContainer,
    TrackerIteration,
} from '@/lib/poker/types';
import { cn } from '@/lib/utils';
import { TicketClasses } from './task-source';

type Mode = 'iteration' | 'query';

/** The picker sits inside the creation form: Enter in its search must not create the game. */
function keepFormClosed(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
        event.preventDefault();
    }
}

type TrackerIssuePickerProps = {
    api: TrackerBrowseApi;
    source: PokerTrackerSource;
    /** External ids of the chosen tickets, in the list's order. */
    selected: string[];
    onSelectedChange: (selected: string[]) => void;
    /** The message of a failed browse; null when the failure is shown elsewhere. */
    describeError: (caught: unknown) => string | null;
    /** Prefix of the field ids. */
    idPrefix?: string;
    /** The id of the refusal shown under the picker, while there is one. */
    errorId?: string;
    maxSelected?: number;
};

/**
 * Browses one tracker (a board and its sprint, or a query) and picks the
 * tickets to import. Mounted again for another source: nothing of a source
 * carries over to the next.
 */
export function TrackerIssuePicker({
    api,
    source,
    selected,
    onSelectedChange,
    describeError,
    idPrefix = 'import',
    errorId,
    maxSelected = 100,
}: TrackerIssuePickerProps): ReactElement {
    const { t } = useTrans();
    const selectionLimit = Math.max(0, Math.min(100, maxSelected));
    const [mode, setMode] = useState<Mode>('iteration');
    const [containerSearch, setContainerSearch] = useState('');
    const [containerOpen, setContainerOpen] = useState(false);
    const [containersLoading, setContainersLoading] = useState(true);
    const [containersFailed, setContainersFailed] = useState(false);
    const [listId, listRef] = useCommandListId();
    const [containers, setContainers] = useState<TrackerContainer[]>([]);
    const [container, setContainer] = useState('');
    /** Stays among the options when a later search leaves it out. */
    const [chosenContainer, setChosenContainer] =
        useState<TrackerContainer | null>(null);
    const [iterations, setIterations] = useState<TrackerIteration[] | null>(
        null,
    );
    const [iteration, setIteration] = useState('');
    const [query, setQuery] = useState('');
    const [issueSearch, setIssueSearch] = useState('');
    const [statusId, setStatusId] = useState('');
    const [projectId, setProjectId] = useState('');
    const [projectSearch, setProjectSearch] = useState('');
    const [projects, setProjects] = useState<TrackerContainer[]>([]);
    const [projectOpen, setProjectOpen] = useState(false);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectPage, setProjectPage] = useState(1);
    const [hasMoreProjects, setHasMoreProjects] = useState(false);
    const [chosenProject, setChosenProject] = useState<TrackerContainer | null>(
        null,
    );
    const [loadingMore, setLoadingMore] = useState(false);
    const [pageFailed, setPageFailed] = useState(false);
    const listRoot = useRef<HTMLUListElement>(null);
    const moreSentinel = useRef<HTMLLIElement>(null);
    const loadingPage = useRef(false);
    const latestPreview = useRef<TrackerPreview | null>(null);
    const latestSelection = useRef(selected);

    const [preview, setPreview] = useState<TrackerPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const containerOptions =
        chosenContainer !== null &&
        !containers.some((item) => item.id === chosenContainer.id)
            ? [chosenContainer, ...containers]
            : containers;
    const isGitHub = source === 'github';
    const isJira = source === 'jira' || source === 'jira_dc';
    const terms = importTerms(source, t);
    const iterationsRequest = useRef(0);
    const previewRequest = useRef(0);

    const selectionChanged = useRef(onSelectedChange);
    useEffect(() => {
        selectionChanged.current = onSelectedChange;
    }, [onSelectedChange]);
    const changeSelection = useCallback((ids: string[]) => {
        latestSelection.current = ids;
        selectionChanged.current(ids);
    }, []);

    useEffect(
        () => () => {
            previewRequest.current += 1;
            iterationsRequest.current += 1;
        },
        [],
    );

    const resetPreview = () => {
        previewRequest.current += 1;
        setLoading(false);
        setLoadingMore(false);
        loadingPage.current = false;
        latestPreview.current = null;
        setPreview(null);
        changeSelection([]);
    };

    const describeFailure = useRef(describeError);
    useEffect(() => {
        describeFailure.current = describeError;
    }, [describeError]);
    const fail = useCallback((caught: unknown) => {
        const message = describeFailure.current(caught);
        if (message !== null) {
            setError(message);
        }
    }, []);

    useEffect(() => {
        if (mode !== 'iteration' && !isGitHub) {
            return;
        }

        let stale = false;
        setContainersLoading(true);
        setContainersFailed(false);

        const timer = setTimeout(() => {
            api.containers(source, containerSearch, 1)
                .then((response) => {
                    if (!stale) {
                        setContainers(response.containers);
                        setContainersLoading(false);
                        setError(null);
                    }
                })
                .catch((caught: unknown) => {
                    if (!stale) {
                        setContainersLoading(false);
                        setContainersFailed(true);
                        fail(caught);
                    }
                });
        }, 300);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [api, source, mode, isGitHub, containerSearch, fail]);

    /** The sprints or milestones of a board, for the iteration tab only. */
    const loadIterations = async (of: string) => {
        iterationsRequest.current += 1;

        const requestId = iterationsRequest.current;

        setIterations(null);
        setIteration('');

        if (
            containerOptions.find((item) => item.id === of)
                ?.supportsIterations === false
        ) {
            setIterations([]);
            return;
        }

        try {
            const response = await api.iterations(source, of);

            if (requestId === iterationsRequest.current) {
                setIterations(response);
            }
        } catch (caught) {
            if (requestId === iterationsRequest.current) {
                fail(caught);
            }
        }
    };

    const chooseContainer = (next: string) => {
        setContainerOpen(false);
        setContainer(next);
        setChosenContainer(
            containerOptions.find((item) => item.id === next) ?? null,
        );
        resetPreview();
        setError(null);

        if (next === '') {
            iterationsRequest.current += 1;
            setIterations(null);
            setIteration('');
            return;
        }

        if (mode === 'iteration') {
            void loadIterations(next);

            return;
        }

        iterationsRequest.current += 1;
        setIterations(null);
        setIteration('');
    };

    const showIssues = useCallback(
        async (append = false) => {
            if (loadingPage.current && append) {
                return;
            }

            previewRequest.current += 1;
            const requestId = previewRequest.current;
            const previous = latestPreview.current;
            loadingPage.current = true;
            setLoadingMore(append);
            setLoading(!append);
            setError(null);

            try {
                const response = await api.preview(source, {
                    mode,
                    ...(mode === 'iteration'
                        ? { iteration_id: iteration }
                        : { query }),
                    ...(container !== '' ? { container } : {}),
                    browse: true,
                    ...(issueSearch.trim() !== ''
                        ? { search: issueSearch.trim() }
                        : {}),
                    ...(statusId !== '' ? { status_id: statusId } : {}),
                    ...(projectId !== '' ? { project_id: projectId } : {}),
                    ...(append && previous?.nextCursor
                        ? { cursor: previous.nextCursor }
                        : {}),
                });

                if (requestId !== previewRequest.current) {
                    return;
                }

                const existingIds = new Set(
                    append
                        ? previous?.issues.map((issue) => issue.externalId)
                        : [],
                );
                const added = response.issues.filter(
                    (issue) => !existingIds.has(issue.externalId),
                );
                const next = {
                    ...response,
                    issues: append
                        ? [...(previous?.issues ?? []), ...added]
                        : response.issues,
                };
                latestPreview.current = next;
                setPreview(next);
                setPageFailed(false);
                changeSelection(
                    (append
                        ? [
                              ...latestSelection.current,
                              ...added
                                  .filter((issue) => !issue.alreadyImported)
                                  .map((issue) => issue.externalId),
                          ]
                        : toggleAll(response.issues, [], selectionLimit)
                    ).slice(0, selectionLimit),
                );
            } catch (caught) {
                if (requestId === previewRequest.current) {
                    setPageFailed(append);
                    if (!append) {
                        latestPreview.current = null;
                        setPreview(null);
                        changeSelection([]);
                    }
                    fail(caught);
                }
            } finally {
                if (requestId === previewRequest.current) {
                    loadingPage.current = false;
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        [
            api,
            source,
            mode,
            iteration,
            query,
            container,
            issueSearch,
            statusId,
            projectId,
            changeSelection,
            selectionLimit,
            fail,
        ],
    );

    useEffect(() => {
        latestSelection.current = selected;
    }, [selected]);

    useEffect(() => {
        if (!isJira || !projectOpen) {
            return;
        }

        let stale = false;
        const timer = setTimeout(() => {
            setProjectsLoading(true);
            void api
                .containers(source, projectSearch, projectPage, true)
                .then((response) => {
                    if (!stale) {
                        setProjects((previous) =>
                            projectPage === 1
                                ? response.containers
                                : [...previous, ...response.containers],
                        );
                        setHasMoreProjects(response.hasMore === true);
                    }
                })
                .catch(fail)
                .finally(() => {
                    if (!stale) {
                        setProjectsLoading(false);
                    }
                });
        }, 300);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [api, source, isJira, projectOpen, projectSearch, projectPage, fail]);

    useEffect(() => {
        if (containerOpen || projectOpen) {
            return;
        }
        const requestId = previewRequest.current;
        const timer = setTimeout(
            () => {
                if (requestId === previewRequest.current) {
                    void showIssues();
                }
            },
            latestPreview.current === null ? 500 : 300,
        );
        return () => clearTimeout(timer);
    }, [showIssues, containerOpen, projectOpen]);

    useEffect(() => {
        if (
            pageFailed ||
            !preview?.nextCursor ||
            loadingMore ||
            loading ||
            typeof IntersectionObserver === 'undefined' ||
            moreSentinel.current === null
        ) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void showIssues(true);
                }
            },
            { root: listRoot.current, rootMargin: '20%' },
        );
        observer.observe(moreSentinel.current);
        return () => observer.disconnect();
    }, [preview, loadingMore, loading, showIssues, pageFailed]);

    const issues = preview?.issues ?? [];
    const importable = issues.filter((issue) => !issue.alreadyImported);
    const selectedCount = importable.filter((issue) =>
        selected.includes(issue.externalId),
    ).length;

    const changeFilter = (): void => {
        previewRequest.current += 1;
        if (latestPreview.current !== null) {
            const next = { ...latestPreview.current, nextCursor: null };
            latestPreview.current = next;
            setPreview(next);
        }
        setLoading(true);
        setLoadingMore(false);
        changeSelection([]);
    };

    const toggle = (externalId: string, checked: boolean) => {
        changeSelection(
            importable
                .map((issue) => issue.externalId)
                .filter((id) =>
                    id === externalId ? checked : selected.includes(id),
                ),
        );
    };

    const chooseMode = (next: Mode) => {
        setMode(next);
        resetPreview();
        setError(null);

        if (next === 'iteration' && container !== '' && iterations === null) {
            void loadIterations(container);
        }
    };

    const containerPicker = (
        <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-container`}>{terms.container}</Label>
            <Popover open={containerOpen} onOpenChange={setContainerOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={`${idPrefix}-container`}
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-label={terms.chooseContainer}
                        aria-haspopup="listbox"
                        aria-expanded={containerOpen}
                        aria-controls={containerOpen ? listId : undefined}
                        className="w-full min-w-0 justify-between font-normal"
                    >
                        <span
                            className={cn(
                                'truncate',
                                !chosenContainer && 'text-muted-foreground',
                            )}
                        >
                            {chosenContainer?.name ?? terms.chooseContainer}
                        </span>
                        <ChevronsUpDown
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    aria-label={terms.container}
                    className="w-(--radix-popover-trigger-width) p-0"
                >
                    <Command shouldFilter={false}>
                        <CommandInput
                            aria-label={terms.searchContainers}
                            value={containerSearch}
                            placeholder={terms.searchContainers}
                            onValueChange={setContainerSearch}
                            onKeyDown={keepFormClosed}
                        />
                        <CommandList
                            ref={listRef}
                            aria-busy={containersLoading}
                        >
                            <CommandGroup>
                                <CommandItem
                                    value="all-containers"
                                    onSelect={() => chooseContainer('')}
                                >
                                    {t('All')}
                                </CommandItem>
                            </CommandGroup>
                            {containersLoading ? (
                                <p
                                    role="status"
                                    className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground"
                                >
                                    <Spinner aria-hidden />
                                    {t('Loading…')}
                                </p>
                            ) : containersFailed ? (
                                <p
                                    role="status"
                                    className="p-4 text-sm text-muted-foreground"
                                >
                                    {t(
                                        'The search is unavailable. Try again in a moment.',
                                    )}
                                </p>
                            ) : containers.length === 0 ? (
                                <p
                                    role="status"
                                    className="p-4 text-sm text-muted-foreground"
                                >
                                    {t('No results found.')}
                                </p>
                            ) : (
                                <CommandGroup>
                                    {containers.map((item) => (
                                        <CommandItem
                                            key={item.id}
                                            value={item.id}
                                            onSelect={() =>
                                                chooseContainer(item.id)
                                            }
                                        >
                                            <span className="truncate">
                                                {item.name}
                                            </span>
                                            {item.id === container && (
                                                <Check
                                                    aria-hidden
                                                    className="ml-auto size-4 shrink-0"
                                                />
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );

    return (
        <div
            data-slot="tracker-issue-picker"
            role="group"
            aria-label={t('Import from :source', {
                source: TrackerLabels[source],
            })}
            aria-invalid={errorId === undefined ? undefined : true}
            aria-describedby={errorId}
            className="@container flex min-w-0 flex-col gap-4"
        >
            <div className="flex min-w-0 flex-col gap-3 border-b border-border pb-4">
                <div className="flex min-h-8 items-center justify-between gap-3">
                    <span className="text-sm font-medium">{t('Filters')}</span>
                    {(container !== '' ||
                        iteration !== '' ||
                        projectId !== '' ||
                        issueSearch !== '' ||
                        statusId !== '' ||
                        query !== '') && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-xs"
                            onClick={() => {
                                iterationsRequest.current += 1;
                                setContainer('');
                                setChosenContainer(null);
                                setIteration('');
                                setIterations(null);
                                setProjectId('');
                                setChosenProject(null);
                                setIssueSearch('');
                                setStatusId('');
                                setQuery('');
                                resetPreview();
                            }}
                        >
                            {t('Clear filters')}
                        </Button>
                    )}
                </div>
                {isJira && (
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label>{t('Project')}</Label>
                        <Popover
                            open={projectOpen}
                            onOpenChange={setProjectOpen}
                        >
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    role="combobox"
                                    aria-label={t('Choose a project')}
                                    aria-expanded={projectOpen}
                                    className="w-full min-w-0 justify-between font-normal"
                                >
                                    <span className="truncate">
                                        {chosenProject?.name ??
                                            t('All projects')}
                                    </span>
                                    <ChevronsUpDown
                                        aria-hidden
                                        className="size-4"
                                    />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0">
                                <Command shouldFilter={false}>
                                    <CommandInput
                                        aria-label={t('Search projects')}
                                        value={projectSearch}
                                        onValueChange={(value) => {
                                            setProjectSearch(value);
                                            setProjectPage(1);
                                        }}
                                    />
                                    <CommandList>
                                        <CommandGroup>
                                            <CommandItem
                                                value="all-projects"
                                                onSelect={() => {
                                                    setProjectId('');
                                                    setChosenProject(null);
                                                    setProjectOpen(false);
                                                    resetPreview();
                                                }}
                                            >
                                                {t('All projects')}
                                            </CommandItem>
                                            {projects.map((item) => (
                                                <CommandItem
                                                    key={item.id}
                                                    value={item.id}
                                                    onSelect={() => {
                                                        setProjectId(item.id);
                                                        setChosenProject(item);
                                                        setProjectOpen(false);
                                                        resetPreview();
                                                    }}
                                                >
                                                    {item.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        {projectsLoading && (
                                            <Spinner
                                                aria-label={t('Loading')}
                                            />
                                        )}
                                        {hasMoreProjects && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                disabled={projectsLoading}
                                                onClick={() =>
                                                    setProjectPage(
                                                        (page) => page + 1,
                                                    )
                                                }
                                            >
                                                {t('Load more')}
                                            </Button>
                                        )}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
                <Tabs
                    variant="line"
                    value={mode}
                    onValueChange={chooseMode}
                    aria-label={t('Import from :source', {
                        source: TrackerLabels[source],
                    })}
                    items={[
                        { value: 'iteration', label: terms.iteration },
                        { value: 'query', label: t('Query') },
                    ]}
                    className="gap-4"
                >
                    <TabsContent value={mode} tabIndex={-1}>
                        <div className="flex min-w-0 flex-col gap-3">
                            {mode === 'iteration' ? (
                                <div className="grid gap-3 @md:grid-cols-2">
                                    {containerPicker}
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <Label
                                            htmlFor={`${idPrefix}-iteration`}
                                        >
                                            {terms.iteration}
                                        </Label>
                                        <Select
                                            value={iteration}
                                            onValueChange={(next) => {
                                                setIteration(next);
                                                resetPreview();
                                                setError(null);
                                            }}
                                            disabled={
                                                iterations === null ||
                                                iterations.length === 0
                                            }
                                        >
                                            <SelectTrigger
                                                id={`${idPrefix}-iteration`}
                                                className="w-full"
                                                aria-label={
                                                    terms.chooseIteration
                                                }
                                            >
                                                <SelectValue
                                                    placeholder={
                                                        container !== '' &&
                                                        iterations === null &&
                                                        !error
                                                            ? t('Loading…')
                                                            : terms.chooseIteration
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(iterations ?? []).map(
                                                    (item) => (
                                                        <SelectItem
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.name} ·{' '}
                                                            {item.state ===
                                                            'active'
                                                                ? t('Active')
                                                                : t('Upcoming')}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {source === 'linear' &&
                                            iteration !== '' && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setIteration('');
                                                        resetPreview();
                                                    }}
                                                >
                                                    {t('Clear :filter', {
                                                        filter: terms.iteration,
                                                    })}
                                                </Button>
                                            )}
                                        {source === 'linear' &&
                                            iteration === '' && (
                                                <p className="text-xs text-muted-foreground">
                                                    {t(
                                                        'No cycle selected: all team issues will be shown.',
                                                    )}
                                                </p>
                                            )}
                                        {source === 'linear' && (
                                            <p className="text-xs text-muted-foreground">
                                                {t(
                                                    'A cycle is a work period in Linear, similar to a sprint.',
                                                )}
                                            </p>
                                        )}
                                        {iterations !== null &&
                                            iterations.length === 0 &&
                                            source !== 'linear' && (
                                                <p className="text-xs text-muted-foreground">
                                                    {terms.noIteration}{' '}
                                                    <button
                                                        type="button"
                                                        className="font-medium text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                                                        onClick={() =>
                                                            chooseMode('query')
                                                        }
                                                    >
                                                        {t(
                                                            'Search issues by query',
                                                        )}
                                                    </button>
                                                </p>
                                            )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex min-w-0 flex-col gap-3">
                                    {isGitHub && containerPicker}
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <Label htmlFor={`${idPrefix}-query`}>
                                            {t('Query')}
                                        </Label>
                                        <Textarea
                                            id={`${idPrefix}-query`}
                                            value={query}
                                            maxLength={1000}
                                            rows={2}
                                            placeholder={terms.queryPlaceholder}
                                            className={cn(
                                                isJira && 'font-mono text-xs',
                                            )}
                                            onChange={(event) => {
                                                setQuery(event.target.value);
                                                resetPreview();
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <div className="grid gap-3 @md:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label htmlFor={`${idPrefix}-issue-search`}>
                            {t('Search issues')}
                        </Label>
                        <Input
                            id={`${idPrefix}-issue-search`}
                            value={issueSearch}
                            onKeyDown={keepFormClosed}
                            onChange={(event) => {
                                setIssueSearch(event.target.value);
                                changeFilter();
                            }}
                            placeholder={t('Search issues')}
                            maxLength={1000}
                        />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label htmlFor={`${idPrefix}-issue-status`}>
                            {t('Status')}
                        </Label>
                        <Select
                            value={statusId || 'all'}
                            onValueChange={(value) => {
                                setStatusId(value === 'all' ? '' : value);
                                changeFilter();
                            }}
                        >
                            <SelectTrigger
                                id={`${idPrefix}-issue-status`}
                                className="w-full"
                                aria-label={t('Status')}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('All statuses')}
                                </SelectItem>
                                {(preview?.statuses ?? []).map((status) => (
                                    <SelectItem
                                        key={status.id}
                                        value={status.id}
                                    >
                                        {status.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {!container &&
                    !iteration &&
                    !projectId &&
                    !query &&
                    !issueSearch &&
                    !statusId && (
                        <p className="text-xs text-muted-foreground">
                            {t(
                                'No filters selected: all accessible issues are shown.',
                            )}
                        </p>
                    )}
            </div>
            {error && <Alert variant="error" title={error} />}
            {loading && (
                <p
                    role="status"
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                    <Spinner aria-hidden />
                    {t('Loading…')}
                </p>
            )}

            {preview && (
                <div
                    data-slot="import-preview"
                    className="flex min-w-0 flex-col gap-2"
                >
                    {issues.length === 0 && !preview.nextCursor ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No issues found.')}
                        </p>
                    ) : (
                        <>
                            <ul
                                ref={listRoot}
                                className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card"
                            >
                                {issues.map((issue) => (
                                    <li
                                        key={issue.externalId}
                                        className="flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-1.5 px-3 py-2.5 text-sm"
                                    >
                                        <Checkbox
                                            aria-label={issue.key}
                                            className="mt-0.5"
                                            checked={
                                                issue.alreadyImported ||
                                                selected.includes(
                                                    issue.externalId,
                                                )
                                            }
                                            disabled={
                                                issue.alreadyImported ||
                                                (selected.length >=
                                                    selectionLimit &&
                                                    !selected.includes(
                                                        issue.externalId,
                                                    ))
                                            }
                                            onCheckedChange={(checked) =>
                                                toggle(
                                                    issue.externalId,
                                                    checked === true,
                                                )
                                            }
                                        />
                                        <span className="flex min-w-0 flex-1 basis-40 flex-col items-start gap-1">
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    TicketClasses,
                                                    'max-w-full',
                                                )}
                                            >
                                                <span className="truncate">
                                                    {issue.key}
                                                </span>
                                            </Badge>
                                            <span
                                                className={cn(
                                                    'max-w-full font-medium break-words',
                                                    issue.alreadyImported &&
                                                        'text-muted-foreground',
                                                )}
                                            >
                                                {issue.title}
                                            </span>
                                            {issue.assignee && (
                                                <span className="max-w-full text-xs break-words text-muted-foreground">
                                                    {issue.assignee}
                                                </span>
                                            )}
                                        </span>
                                        {issue.status && (
                                            <Badge variant="muted">
                                                {issue.status}
                                            </Badge>
                                        )}
                                        {issue.estimate && (
                                            <Badge variant="soft" shape="pill">
                                                {issue.estimate}
                                            </Badge>
                                        )}
                                        {issue.alreadyImported && (
                                            <Badge variant="muted">
                                                {t('Already imported')}
                                            </Badge>
                                        )}
                                    </li>
                                ))}
                                {preview.nextCursor && (
                                    <li
                                        ref={moreSentinel}
                                        className="p-3 text-center"
                                    >
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={loadingMore}
                                            onClick={() =>
                                                void showIssues(true)
                                            }
                                        >
                                            {loadingMore ? (
                                                <Spinner aria-hidden />
                                            ) : null}
                                            {loadingMore
                                                ? t('Loading…')
                                                : t('Load more')}
                                        </Button>
                                    </li>
                                )}
                            </ul>
                            <div
                                data-slot="import-selection"
                                className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"
                            >
                                <span className="min-w-0 tabular-nums">
                                    {selectionLabel(
                                        selectedCount,
                                        importable.length,
                                        t,
                                    )}
                                </span>
                                <label className="flex items-center gap-2 font-semibold text-foreground">
                                    <Checkbox
                                        aria-label={t('Select all')}
                                        checked={
                                            selectionLimit > 0 &&
                                            importable.length > 0 &&
                                            selectedCount ===
                                                Math.min(
                                                    importable.length,
                                                    selectionLimit,
                                                )
                                        }
                                        disabled={
                                            importable.length === 0 ||
                                            selectionLimit === 0
                                        }
                                        onCheckedChange={() =>
                                            changeSelection(
                                                toggleAll(
                                                    issues,
                                                    selected,
                                                    selectionLimit,
                                                ).slice(0, selectionLimit),
                                            )
                                        }
                                    />
                                    {t('Select all')}
                                </label>
                            </div>
                            {selected.length >= selectionLimit && (
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        selectionLimit === 100
                                            ? 'You can import up to 100 issues at a time.'
                                            : 'You can import up to :count issues into this game.',
                                        { count: selectionLimit },
                                    )}
                                </p>
                            )}
                            {preview.truncated && !preview.nextCursor && (
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Showing the first 100. Narrow the query.',
                                    )}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
