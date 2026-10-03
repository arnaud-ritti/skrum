import { Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
}: TrackerIssuePickerProps): ReactElement {
    const { t } = useTrans();
    const [mode, setMode] = useState<Mode>('iteration');
    const [containerSearch, setContainerSearch] = useState('');
    const [containers, setContainers] = useState<TrackerContainer[]>([]);
    const [container, setContainer] = useState('');
    const [iterations, setIterations] = useState<TrackerIteration[] | null>(
        null,
    );
    const [iteration, setIteration] = useState('');
    const [query, setQuery] = useState('');
    const [preview, setPreview] = useState<TrackerPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isGitHub = source === 'github';
    const isJira = source === 'jira' || source === 'jira_dc';
    const terms = importTerms(source, t);
    const iterationsRequest = useRef(0);
    const previewRequest = useRef(0);

    const resetPreview = () => {
        previewRequest.current += 1;
        setLoading(false);
        setPreview(null);
        onSelectedChange([]);
    };

    const fail = useCallback(
        (caught: unknown) => {
            const message = describeError(caught);

            if (message !== null) {
                setError(message);
            }
        },
        [describeError],
    );

    useEffect(() => {
        if (mode !== 'iteration' && !isGitHub) {
            return;
        }

        let stale = false;

        const timer = setTimeout(() => {
            api.containers(source, containerSearch, 1)
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
    }, [api, source, mode, isGitHub, containerSearch, fail]);

    const chooseContainer = async (next: string) => {
        iterationsRequest.current += 1;

        const requestId = iterationsRequest.current;

        setContainer(next);
        setIterations(null);
        setIteration('');
        resetPreview();
        setError(null);

        try {
            const response = await api.iterations(source, next);

            if (requestId === iterationsRequest.current) {
                setIterations(response);
            }
        } catch (caught) {
            if (requestId === iterationsRequest.current) {
                fail(caught);
            }
        }
    };

    const showIssues = async () => {
        previewRequest.current += 1;

        const requestId = previewRequest.current;

        setLoading(true);
        setError(null);

        try {
            const response = await api.preview(
                source,
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
            onSelectedChange(toggleAll(response.issues, []));
        } catch (caught) {
            if (requestId === previewRequest.current) {
                setPreview(null);
                onSelectedChange([]);
                fail(caught);
            }
        } finally {
            if (requestId === previewRequest.current) {
                setLoading(false);
            }
        }
    };

    const issues = preview?.issues ?? [];
    const importable = issues.filter((issue) => !issue.alreadyImported);
    const selectedCount = importable.filter((issue) =>
        selected.includes(issue.externalId),
    ).length;

    const toggle = (externalId: string, checked: boolean) => {
        onSelectedChange(
            importable
                .map((issue) => issue.externalId)
                .filter((id) =>
                    id === externalId ? checked : selected.includes(id),
                ),
        );
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
            <Label htmlFor={`${idPrefix}-container-search`}>
                {terms.container}
            </Label>
            <Input
                id={`${idPrefix}-container-search`}
                value={containerSearch}
                placeholder={terms.searchContainers}
                onChange={(event) => setContainerSearch(event.target.value)}
                onKeyDown={keepFormClosed}
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
        <div
            data-slot="tracker-issue-picker"
            className="@container flex min-w-0 flex-col gap-4"
        >
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
                                    <Label htmlFor={`${idPrefix}-iteration`}>
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
                                            id={`${idPrefix}-iteration`}
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

                        <Button
                            type="button"
                            variant="outline"
                            className="max-w-full min-w-0 self-start"
                            disabled={!canShow || loading}
                            onClick={() => void showIssues()}
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
                    </div>
                </TabsContent>
            </Tabs>

            {error && <Alert variant="error" title={error} />}

            {preview && (
                <div
                    data-slot="import-preview"
                    className="flex min-w-0 flex-col gap-2"
                >
                    {issues.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No issues found.')}
                        </p>
                    ) : (
                        <>
                            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
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
                                            importable.length > 0 &&
                                            selectedCount === importable.length
                                        }
                                        disabled={importable.length === 0}
                                        onCheckedChange={() =>
                                            onSelectedChange(
                                                toggleAll(issues, selected),
                                            )
                                        }
                                    />
                                    {t('Select all')}
                                </label>
                            </div>
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
        </div>
    );
}
