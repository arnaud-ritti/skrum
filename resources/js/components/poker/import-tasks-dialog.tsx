import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import { Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import PokerImportContainersController from '@/actions/App/Http/Controllers/Integrations/PokerImportContainersController';
import PokerImportIterationsController from '@/actions/App/Http/Controllers/Integrations/PokerImportIterationsController';
import PokerImportPreviewsController from '@/actions/App/Http/Controllers/Integrations/PokerImportPreviewsController';
import PokerImportsController from '@/actions/App/Http/Controllers/Integrations/PokerImportsController';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
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
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import {
    TrackerLabels,
    isPokerTrackerSource,
    type PokerTrackerSource,
    type TrackerContainer,
    type TrackerIssuePreview,
    type TrackerIteration,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { cn } from '@/lib/utils';
import { useGame } from './game-context';
import { TicketClasses } from './task-source';

type Mode = 'iteration' | 'query';

type Preview = { issues: TrackerIssuePreview[]; truncated: boolean };

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sources: PokerTrackerSource[];
};

type Translate = ReturnType<typeof useTrans>['t'];

type ImportTerms = {
    container: string;
    searchContainers: string;
    chooseContainer: string;
    iteration: string;
    chooseIteration: string;
    noIteration: string;
    queryPlaceholder: string;
};

function importTerms(source: PokerTrackerSource, t: Translate): ImportTerms {
    switch (source) {
        case 'jira':
        case 'jira_dc':
            return {
                container: t('Board'),
                searchContainers: t('Search boards'),
                chooseContainer: t('Choose a board'),
                iteration: t('Sprint'),
                chooseIteration: t('Choose a sprint'),
                noIteration: t('No active or upcoming sprint.'),
                queryPlaceholder: t(
                    'JQL, for example project = PROJ AND sprint in openSprints()',
                ),
            };
        case 'github':
            return {
                container: t('Repository'),
                searchContainers: t('Search repositories'),
                chooseContainer: t('Choose a repository'),
                iteration: t('Milestone'),
                chooseIteration: t('Choose a milestone'),
                noIteration: t('No open milestone.'),
                queryPlaceholder: t('Search GitHub issues'),
            };
        default:
            return {
                container: t('Team'),
                searchContainers: t('Search teams'),
                chooseContainer: t('Choose a team'),
                iteration: t('Cycle'),
                chooseIteration: t('Choose a cycle'),
                noIteration: t('No active or upcoming cycle.'),
                queryPlaceholder: t('Search Linear issues'),
            };
    }
}

export function ImportTasksDialog({ open, onOpenChange, sources }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent data-slot="poker-import" className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('Import tasks')}</DialogTitle>
                    <DialogDescription>
                        {t('Pick the issues to add to the tasks of this game.')}
                    </DialogDescription>
                </DialogHeader>
                {open && sources.length > 0 && (
                    <ImportForm
                        sources={sources}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function ImportForm({
    sources,
    onDone,
}: {
    sources: PokerTrackerSource[];
    onDone: () => void;
}) {
    const { snapshot, run, refetch, handleError } = useGame();
    const { t } = useTrans();
    const gameId = snapshot.game.id;
    const [source, setSource] = useState<PokerTrackerSource>(sources[0]);
    const [mode, setMode] = useState<Mode>('iteration');
    const [containerSearch, setContainerSearch] = useState('');
    const [containers, setContainers] = useState<TrackerContainer[]>([]);
    const [container, setContainer] = useState('');
    const [iterations, setIterations] = useState<TrackerIteration[] | null>(
        null,
    );
    const [iteration, setIteration] = useState('');
    const [query, setQuery] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isGitHub = source === 'github';
    const terms = importTerms(source, t);
    const iterationsRequest = useRef(0);
    const previewRequest = useRef(0);

    const resetPreview = () => {
        previewRequest.current += 1;
        setLoading(false);
        setPreview(null);
        setSelected(new Set());
    };

    const fail = useCallback(
        (caught: unknown) => {
            const message = handleError(caught);

            if (message !== null) {
                setError(message);
            }
        },
        [handleError],
    );

    useEffect(() => {
        if (mode !== 'iteration' && !isGitHub) {
            return;
        }

        let stale = false;

        const timer = setTimeout(() => {
            retroRequest<{ containers: TrackerContainer[] }>(
                PokerImportContainersController.index(
                    { game: gameId, source },
                    { query: { q: containerSearch, page: 1 } },
                ),
            )
                .then((response) => {
                    if (!stale) {
                        setContainers(response.containers);
                    }
                })
                .catch((caught: unknown) => {
                    if (!stale) {
                        fail(caught);
                    }
                });
        }, 300);

        return () => {
            stale = true;
            clearTimeout(timer);
        };
    }, [gameId, source, mode, isGitHub, containerSearch, fail]);

    const chooseSource = (next: string) => {
        if (!isPokerTrackerSource(next)) {
            return;
        }

        setSource(next);
        setContainerSearch('');
        setContainers([]);
        setContainer('');
        setIterations(null);
        setIteration('');
        iterationsRequest.current += 1;
        resetPreview();
        setError(null);
    };

    const chooseContainer = async (next: string) => {
        iterationsRequest.current += 1;

        const requestId = iterationsRequest.current;

        setContainer(next);
        setIterations(null);
        setIteration('');
        resetPreview();
        setError(null);

        try {
            const response = await retroRequest<TrackerIteration[]>(
                PokerImportIterationsController.index(
                    { game: gameId, source },
                    { query: { container: next } },
                ),
            );

            if (requestId === iterationsRequest.current) {
                setIterations(response);
            }
        } catch (caught) {
            if (requestId === iterationsRequest.current) {
                fail(caught);
            }
        }
    };

    const showIssues = async (event: FormEvent) => {
        event.preventDefault();
        previewRequest.current += 1;

        const requestId = previewRequest.current;

        setLoading(true);
        setError(null);

        try {
            const response = await retroRequest<Preview>(
                PokerImportPreviewsController.store({ game: gameId, source }),
                mode === 'iteration'
                    ? { mode, iteration_id: iteration }
                    : {
                          mode,
                          query,
                          container: isGitHub ? container : undefined,
                      },
            );

            if (requestId !== previewRequest.current) {
                return;
            }

            setPreview(response);
            setSelected(
                new Set(
                    response.issues
                        .filter((issue) => !issue.alreadyImported)
                        .map((issue) => issue.externalId),
                ),
            );
        } catch (caught) {
            if (requestId === previewRequest.current) {
                setPreview(null);
                fail(caught);
            }
        } finally {
            if (requestId === previewRequest.current) {
                setLoading(false);
            }
        }
    };

    const importable = useMemo(
        () => preview?.issues.filter((issue) => !issue.alreadyImported) ?? [],
        [preview],
    );

    const selectedCount = importable.filter((issue) =>
        selected.has(issue.externalId),
    ).length;

    const toggle = (externalId: string, checked: boolean) => {
        setSelected((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(externalId);
            } else {
                next.delete(externalId);
            }

            return next;
        });
    };

    const toggleAll = (checked: boolean) => {
        setSelected(
            checked
                ? new Set(importable.map((issue) => issue.externalId))
                : new Set(),
        );
    };

    const importSelected = async () => {
        const externalIds = importable
            .map((issue) => issue.externalId)
            .filter((id) => selected.has(id));

        setImporting(true);

        const result = await run(
            retroRequest<{ imported: number; skipped: number }>(
                PokerImportsController.store({ game: gameId, source }),
                { external_ids: externalIds },
            ),
        );

        setImporting(false);

        if (result) {
            toast.success(
                t(':imported imported, :skipped skipped.', {
                    imported: result.imported,
                    skipped: result.skipped,
                }),
            );
            await refetch();
            onDone();
        }
    };

    const canShow =
        mode === 'iteration'
            ? iteration !== ''
            : query.trim() !== '' && (!isGitHub || container !== '');

    const chooseMode = (next: Mode) => {
        setMode(next);
        resetPreview();
        setError(null);
    };

    const containerPicker = (
        <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="import-container-search">{terms.container}</Label>
            <Input
                id="import-container-search"
                value={containerSearch}
                placeholder={terms.searchContainers}
                onChange={(event) => setContainerSearch(event.target.value)}
            />
            <Select
                value={container}
                onValueChange={(next) => void chooseContainer(next)}
            >
                <SelectTrigger
                    className="w-full"
                    aria-label={terms.chooseContainer}
                >
                    <SelectValue placeholder={terms.chooseContainer} />
                </SelectTrigger>
                <SelectContent>
                    {containers.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                            {item.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {sources.length > 1 && (
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    fullWidth
                    value={source}
                    onValueChange={chooseSource}
                    aria-label={t('Source')}
                    options={sources.map((item) => ({
                        value: item,
                        label: TrackerLabels[item],
                    }))}
                />
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
                    <form
                        className="flex min-w-0 flex-col gap-3"
                        onSubmit={(event) => void showIssues(event)}
                    >
                        {mode === 'iteration' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {containerPicker}
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <Label htmlFor="import-iteration">
                                        {terms.iteration}
                                    </Label>
                                    <Select
                                        value={iteration}
                                        onValueChange={(next) => {
                                            setIteration(next);
                                            resetPreview();
                                        }}
                                        disabled={iterations === null}
                                    >
                                        <SelectTrigger
                                            id="import-iteration"
                                            className="w-full"
                                            aria-label={terms.chooseIteration}
                                        >
                                            <SelectValue
                                                placeholder={
                                                    terms.chooseIteration
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(iterations ?? []).map((item) => (
                                                <SelectItem
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name} ·{' '}
                                                    {item.state === 'active'
                                                        ? t('Active')
                                                        : t('Upcoming')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {iterations !== null &&
                                        iterations.length === 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                {terms.noIteration}
                                            </p>
                                        )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex min-w-0 flex-col gap-3">
                                {isGitHub && containerPicker}
                                <div className="flex min-w-0 flex-col gap-1.5">
                                    <Label htmlFor="import-query">
                                        {t('Query')}
                                    </Label>
                                    <Textarea
                                        id="import-query"
                                        value={query}
                                        maxLength={1000}
                                        rows={2}
                                        placeholder={terms.queryPlaceholder}
                                        onChange={(event) => {
                                            setQuery(event.target.value);
                                            resetPreview();
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="outline"
                            className="max-w-full min-w-0 self-start"
                            disabled={!canShow || loading}
                        >
                            {loading ? (
                                <Spinner aria-hidden />
                            ) : (
                                <Search aria-hidden />
                            )}
                            <span className="truncate">
                                {loading ? t('Loading…') : t('Show issues')}
                            </span>
                        </Button>
                    </form>
                </TabsContent>
            </Tabs>

            {error && <Alert variant="error" title={error} />}

            {preview && (
                <div
                    data-slot="import-preview"
                    className="flex min-w-0 flex-col gap-2"
                >
                    {preview.issues.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No issues found.')}
                        </p>
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-sm font-semibold">
                                <Checkbox
                                    checked={
                                        importable.length > 0 &&
                                        selectedCount === importable.length
                                    }
                                    disabled={importable.length === 0}
                                    onCheckedChange={(checked) =>
                                        toggleAll(checked === true)
                                    }
                                />
                                {t('Select all')}
                            </label>
                            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
                                {preview.issues.map((issue) => (
                                    <li
                                        key={issue.externalId}
                                        className="flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-1.5 px-3 py-2.5 text-sm"
                                    >
                                        <Checkbox
                                            aria-label={issue.key}
                                            className="mt-0.5"
                                            checked={
                                                issue.alreadyImported ||
                                                selected.has(issue.externalId)
                                            }
                                            disabled={issue.alreadyImported}
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
                            </ul>
                            {preview.truncated && (
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

            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    className="min-w-0"
                    onClick={onDone}
                >
                    <span className="truncate">{t('Cancel')}</span>
                </Button>
                <Button
                    type="button"
                    className="min-w-0"
                    disabled={selectedCount === 0 || importing}
                    onClick={() => void importSelected()}
                >
                    {importing ? (
                        <Spinner aria-hidden />
                    ) : (
                        <Download aria-hidden />
                    )}
                    <span className="truncate">
                        {t('Import :count tasks', { count: selectedCount })}
                    </span>
                </Button>
            </DialogFooter>
        </div>
    );
}
