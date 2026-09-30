import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
} from 'react';
import { toast } from 'sonner';
import PokerImportContainersController from '@/actions/App/Http/Controllers/Integrations/PokerImportContainersController';
import PokerImportIterationsController from '@/actions/App/Http/Controllers/Integrations/PokerImportIterationsController';
import PokerImportPreviewsController from '@/actions/App/Http/Controllers/Integrations/PokerImportPreviewsController';
import PokerImportsController from '@/actions/App/Http/Controllers/Integrations/PokerImportsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';
import {
    TrackerLabels,
    type PokerTrackerSource,
    type TrackerContainer,
    type TrackerIssuePreview,
    type TrackerIteration,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Mode = 'iteration' | 'query';

type Preview = { issues: TrackerIssuePreview[]; truncated: boolean };

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sources: PokerTrackerSource[];
};

export function ImportTasksDialog({ open, onOpenChange, sources }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                className="sm:max-w-2xl"
            >
                <DialogTitle>{t('Import tasks')}</DialogTitle>
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
    const isJira = source === 'jira';
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
        if (mode !== 'iteration') {
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
    }, [gameId, source, mode, containerSearch, fail]);

    const chooseSource = (next: string) => {
        if (next !== 'jira' && next !== 'linear') {
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
                    : { mode, query },
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
        mode === 'iteration' ? iteration !== '' : query.trim() !== '';

    return (
        <div className="space-y-4">
            {sources.length > 1 && (
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={source}
                    onValueChange={chooseSource}
                    aria-label={t('Source')}
                >
                    {sources.map((item) => (
                        <ToggleGroupItem key={item} value={item}>
                            {TrackerLabels[item]}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            )}

            <ToggleGroup
                type="single"
                variant="outline"
                value={mode}
                onValueChange={(next) => {
                    if (next === 'iteration' || next === 'query') {
                        setMode(next);
                        resetPreview();
                        setError(null);
                    }
                }}
                aria-label={t('Import from :source', {
                    source: TrackerLabels[source],
                })}
            >
                <ToggleGroupItem value="iteration">
                    {isJira ? t('Sprint') : t('Cycle')}
                </ToggleGroupItem>
                <ToggleGroupItem value="query">{t('Query')}</ToggleGroupItem>
            </ToggleGroup>

            <form
                className="space-y-3"
                onSubmit={(event) => void showIssues(event)}
            >
                {mode === 'iteration' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="import-container-search">
                                {isJira ? t('Board') : t('Team')}
                            </Label>
                            <Input
                                id="import-container-search"
                                value={containerSearch}
                                placeholder={
                                    isJira
                                        ? t('Search boards')
                                        : t('Search teams')
                                }
                                onChange={(event) =>
                                    setContainerSearch(event.target.value)
                                }
                            />
                            <Select
                                value={container}
                                onValueChange={(next) =>
                                    void chooseContainer(next)
                                }
                            >
                                <SelectTrigger
                                    aria-label={
                                        isJira
                                            ? t('Choose a board')
                                            : t('Choose a team')
                                    }
                                >
                                    <SelectValue
                                        placeholder={
                                            isJira
                                                ? t('Choose a board')
                                                : t('Choose a team')
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {containers.map((item) => (
                                        <SelectItem
                                            key={item.id}
                                            value={item.id}
                                        >
                                            {item.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>{isJira ? t('Sprint') : t('Cycle')}</Label>
                            <Select
                                value={iteration}
                                onValueChange={(next) => {
                                    setIteration(next);
                                    resetPreview();
                                }}
                                disabled={iterations === null}
                            >
                                <SelectTrigger
                                    aria-label={
                                        isJira
                                            ? t('Choose a sprint')
                                            : t('Choose a cycle')
                                    }
                                >
                                    <SelectValue
                                        placeholder={
                                            isJira
                                                ? t('Choose a sprint')
                                                : t('Choose a cycle')
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
                            {iterations !== null && iterations.length === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {isJira
                                        ? t('No active or upcoming sprint.')
                                        : t('No active or upcoming cycle.')}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        <Label htmlFor="import-query">{t('Query')}</Label>
                        <Textarea
                            id="import-query"
                            value={query}
                            maxLength={1000}
                            rows={2}
                            placeholder={
                                isJira
                                    ? t(
                                          'JQL, for example project = PROJ AND sprint in openSprints()',
                                      )
                                    : t('Search Linear issues')
                            }
                            onChange={(event) => {
                                setQuery(event.target.value);
                                resetPreview();
                            }}
                        />
                    </div>
                )}

                <Button
                    type="submit"
                    variant="secondary"
                    disabled={!canShow || loading}
                >
                    {loading ? t('Loading…') : t('Show issues')}
                </Button>
            </form>

            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}

            {preview && (
                <div className="space-y-2">
                    {preview.issues.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No issues found.')}
                        </p>
                    ) : (
                        <>
                            <label className="flex items-center gap-2 text-sm font-medium">
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
                            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
                                {preview.issues.map((issue) => (
                                    <li
                                        key={issue.externalId}
                                        className="flex items-start gap-2 p-2 text-sm"
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
                                        <span className="min-w-0 flex-1">
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {issue.key}
                                            </span>{' '}
                                            <span className="break-words">
                                                {issue.title}
                                            </span>
                                            {issue.assignee && (
                                                <span className="block text-xs text-muted-foreground">
                                                    {issue.assignee}
                                                </span>
                                            )}
                                        </span>
                                        {issue.estimate && (
                                            <Badge variant="secondary">
                                                {issue.estimate}
                                            </Badge>
                                        )}
                                        {issue.alreadyImported && (
                                            <Badge variant="outline">
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

            <DialogFooter className="gap-2">
                <Button variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button
                    disabled={selectedCount === 0 || importing}
                    onClick={() => void importSelected()}
                >
                    {t('Import :count tasks', { count: selectedCount })}
                </Button>
            </DialogFooter>
        </div>
    );
}
