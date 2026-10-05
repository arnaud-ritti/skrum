import { CircleAlert, CircleCheck, Send } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
    EmptyExportTarget,
    ExportTargetFields,
    exportTargetBody,
} from '@/components/action-items/export-target-fields';
import type {
    ExportTarget,
    IntegrationScope,
} from '@/components/action-items/export-target-fields';
import { ExportTimeoutMs } from '@/components/action-items/item-export';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
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
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { boardActionItemEndpoints } from '@/lib/action-items/endpoints';
import {
    BulkExportError,
    itemsToExport,
    runBulkExport,
} from '@/lib/action-items/bulk-export';
import type { BulkExportOutcome } from '@/lib/action-items/bulk-export';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type { ExportSource, ExportWarning } from '@/types/integrations';
import { useBoard } from './board-context';

type Stage = 'choosing' | 'running' | 'done';

type Props = {
    source: ExportSource;
    scope: IntegrationScope;
    onClose: () => void;
};

function OutcomeLine({ outcome }: { outcome: BulkExportOutcome | undefined }) {
    const { t } = useTrans();

    if (outcome === undefined || outcome.state === 'pending') {
        return null;
    }

    if (outcome.state === 'running') {
        return (
            <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-muted-foreground">
                <Spinner className="shrink-0" />
                <span className="truncate">{t('Exporting…')}</span>
            </span>
        );
    }

    if (outcome.state === 'exported') {
        return (
            <span className="flex min-w-0 items-center gap-1.5 text-body-sm text-skrum-success-text">
                <CircleCheck aria-hidden className="size-4 shrink-0" />
                {outcome.url === '' ? (
                    <span className="truncate">{t('Exported')}</span>
                ) : (
                    <a
                        href={outcome.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono underline-offset-2 outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        {outcome.key || outcome.url}
                    </a>
                )}
            </span>
        );
    }

    if (outcome.state === 'skipped') {
        return (
            <span className="text-body-sm text-muted-foreground">
                {t('Already exported')}
            </span>
        );
    }

    if (!('message' in outcome)) {
        return null;
    }

    return (
        <span className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 wrap-anywhere">
                {outcome.message ?? t('Something went wrong.')}
            </span>
        </span>
    );
}

/**
 * Sends the retro's action items to one tracker, one request per item
 * through the endpoint of a single item (decision 9): each keeps its own
 * rights, lock and "already exported" answer.
 */
export function BulkExportDialog({
    source,
    scope,
    onClose,
}: Props): ReactElement {
    const { board, apply } = useBoard();
    const { t } = useTrans();
    const isMobile = useIsMobile();
    const restoreFocus = useRestoreFocus(true);
    const [listed] = useState<ActionItem[]>(() =>
        itemsToExport(board.actionItems, source.source),
    );
    const [ticked, setTicked] = useState<Set<string>>(
        () => new Set(listed.map((item) => item.id)),
    );
    const [target, setTarget] = useState<ExportTarget>(EmptyExportTarget);
    const [ready, setReady] = useState(false);
    const [stage, setStage] = useState<Stage>('choosing');
    const [run, setRun] = useState<string[]>([]);
    const [outcomes, setOutcomes] = useState<Map<string, BulkExportOutcome>>(
        () => new Map(),
    );
    const [warnings, setWarnings] = useState<Map<string, string[]>>(
        () => new Map(),
    );
    const [confirmingStop, setConfirmingStop] = useState(false);
    const stopped = useRef(false);
    const endpoints = useMemo(
        () => boardActionItemEndpoints(board.retro.id),
        [board.retro.id],
    );
    const provider = source.label;
    const running = stage === 'running';
    const shown =
        stage === 'choosing'
            ? listed
            : listed.filter((item) => outcomes.has(item.id));
    const states = [...outcomes.values()].map((outcome) => outcome.state);
    const exportedCount = states.filter((state) => state === 'exported').length;
    const skippedCount = states.filter((state) => state === 'skipped').length;
    const failedIds = [...outcomes.values()]
        .filter((outcome) => outcome.state === 'failed')
        .map((outcome) => outcome.itemId);
    const current =
        run.filter((itemId) => {
            const state = outcomes.get(itemId)?.state;

            return state !== undefined && state !== 'pending';
        }).length || 1;

    const exportOne = async (
        itemId: string,
    ): Promise<{ key: string; url: string }> => {
        let response: { actionItem: ActionItem; warnings: ExportWarning[] };

        try {
            response = await retroRequest(
                endpoints.exportItem(itemId),
                exportTargetBody(source.source, target),
                { timeoutMs: ExportTimeoutMs },
            );
        } catch (error) {
            if (error instanceof RetroRequestError && error.status > 0) {
                throw new BulkExportError(error.status, error.message);
            }

            throw error;
        }

        apply({ type: 'actionItem.upsert', actionItem: response.actionItem });

        const messages = response.warnings
            .map((warning) => warning.message)
            .filter((message): message is string => message !== null);

        if (messages.length > 0) {
            setWarnings((previous) => new Map(previous).set(itemId, messages));
        }

        const link = response.actionItem.externalLinks?.find(
            (candidate) => candidate.source === source.source,
        );

        return { key: link?.key ?? '', url: link?.url ?? '' };
    };

    const start = async (itemIds: string[]): Promise<void> => {
        if (itemIds.length === 0 || !ready) {
            return;
        }

        const merge = (latest: BulkExportOutcome[]) =>
            setOutcomes((previous) => {
                const next = new Map(previous);

                for (const outcome of latest) {
                    next.set(outcome.itemId, outcome);
                }

                return next;
            });

        stopped.current = false;
        setRun(itemIds);
        setStage('running');
        setWarnings((previous) => {
            const next = new Map(previous);

            for (const itemId of itemIds) {
                next.delete(itemId);
            }

            return next;
        });
        merge(itemIds.map((itemId) => ({ itemId, state: 'pending' })));
        merge(
            await runBulkExport(
                itemIds,
                exportOne,
                merge,
                () => stopped.current,
            ),
        );
        setStage('done');
    };

    const requestClose = () => {
        if (running) {
            setConfirmingStop(true);

            return;
        }

        onClose();
    };

    const toggle = (itemId: string, checked: boolean) =>
        setTicked((previous) => {
            const next = new Set(previous);

            if (checked) {
                return next.add(itemId);
            }

            next.delete(itemId);

            return next;
        });

    const tickedIds = listed
        .filter((item) => ticked.has(item.id))
        .map((item) => item.id);
    const title = t('Export to :provider', { provider });
    const description =
        stage === 'running'
            ? t('Exporting :current of :total…', {
                  current,
                  total: run.length,
              })
            : stage === 'done'
              ? t(
                    skippedCount > 0
                        ? ':exported exported, :skipped already linked, :failed failed.'
                        : ':exported exported, :failed failed',
                    {
                        exported: exportedCount,
                        skipped: skippedCount,
                        failed: failedIds.length,
                    },
                )
              : t(
                    'Creates one issue per action item, with a link back to skrum. Later changes are not synced.',
                );

    const body: ReactNode = (
        <div className="flex min-w-0 flex-col gap-4">
            <ExportTargetFields
                source={source}
                scope={scope}
                teamId={board.retro.teamId}
                value={target}
                onChange={setTarget}
                disabled={running}
                onReadyChange={setReady}
            />
            <ul
                data-slot="bulk-export-items"
                aria-live="polite"
                className="flex min-w-0 flex-col divide-y rounded-lg border"
            >
                {shown.map((item) => (
                    <li
                        key={item.id}
                        data-item-id={item.id}
                        data-state={outcomes.get(item.id)?.state}
                        className="flex min-w-0 flex-col gap-1 px-3 py-2"
                    >
                        {stage === 'choosing' ? (
                            <Checkbox
                                label={
                                    <span className="wrap-anywhere">
                                        {item.content}
                                    </span>
                                }
                                checked={ticked.has(item.id)}
                                onCheckedChange={(checked) =>
                                    toggle(item.id, checked === true)
                                }
                            />
                        ) : (
                            <>
                                <span className="min-w-0 text-sm wrap-anywhere">
                                    {item.content}
                                </span>
                                <OutcomeLine outcome={outcomes.get(item.id)} />
                                {(warnings.get(item.id) ?? []).map(
                                    (message, index) => (
                                        <span
                                            key={`${index}-${message}`}
                                            className="text-body-sm wrap-anywhere text-skrum-warning-text"
                                        >
                                            {message}
                                        </span>
                                    ),
                                )}
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );

    const footer: ReactNode = (
        <>
            {stage === 'choosing' && (
                <>
                    <Button type="button" variant="outline" onClick={onClose}>
                        <span className="truncate">{t('Cancel')}</span>
                    </Button>
                    <Button
                        type="button"
                        disabled={!ready || tickedIds.length === 0}
                        onClick={() => void start(tickedIds)}
                    >
                        <span className="truncate">
                            {tickedIds.length === 1
                                ? t('Export 1 item')
                                : t('Export :count items', {
                                      count: tickedIds.length,
                                  })}
                        </span>
                    </Button>
                </>
            )}
            {stage === 'running' && (
                <Button type="button" variant="outline" onClick={requestClose}>
                    <span className="truncate">{t('Stop')}</span>
                </Button>
            )}
            {stage === 'done' && (
                <>
                    {failedIds.length > 0 && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!ready}
                            onClick={() => void start(failedIds)}
                        >
                            <span className="truncate">
                                {t('Retry the failed ones')}
                            </span>
                        </Button>
                    )}
                    <Button type="button" onClick={onClose}>
                        <span className="truncate">{t('Close')}</span>
                    </Button>
                </>
            )}
        </>
    );

    const stopConfirmation = (
        <ConfirmDialog
            open={confirmingStop}
            onOpenChange={setConfirmingStop}
            title={t('Stop the export?')}
            description={t(
                'The items already exported stay in :provider. The one on its way may still arrive, the others are not sent.',
                { provider },
            )}
            confirmLabel={t('Stop')}
            cancelLabel={t('Keep exporting')}
            onConfirm={async () => {
                stopped.current = true;
                onClose();
            }}
        />
    );

    if (isMobile) {
        return (
            <>
                <Drawer
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            requestClose();
                        }
                    }}
                >
                    <DrawerContent
                        data-slot="retro-bulk-export"
                        className="overflow-y-auto"
                        onCloseAutoFocus={restoreFocus}
                    >
                        <DrawerHeader className="pr-10 text-left">
                            <DrawerTitle>{title}</DrawerTitle>
                            <DrawerDescription>{description}</DrawerDescription>
                        </DrawerHeader>
                        <div className="px-4">{body}</div>
                        <DrawerFooter>{footer}</DrawerFooter>
                    </DrawerContent>
                </Drawer>
                {stopConfirmation}
            </>
        );
    }

    return (
        <>
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) {
                        requestClose();
                    }
                }}
            >
                <DialogContent
                    data-slot="retro-bulk-export"
                    onCloseAutoFocus={restoreFocus}
                >
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    {body}
                    <DialogFooter>{footer}</DialogFooter>
                </DialogContent>
            </Dialog>
            {stopConfirmation}
        </>
    );
}

/**
 * "Export to Jira" in the header of the retro's actions (RT-10): one button
 * for the only tracker of the team, a menu for several; nothing for a guest
 * or once every item is in every tracker.
 */
export function BulkExport(): ReactElement | null {
    const { board } = useBoard();
    const { t } = useTrans();
    const [chosen, setChosen] = useState<ExportSource | null>(null);
    const scope: IntegrationScope | null =
        board.links.workspace === null || board.viewer.userId === null
            ? null
            : {
                  workspace: board.links.workspace,
                  canManagePeople: board.viewer.isWorkspaceManager,
              };
    const available = board.exportSources.filter(
        (source) => itemsToExport(board.actionItems, source.source).length > 0,
    );

    if (board.viewer.isGuest || scope === null) {
        return null;
    }

    if (available.length === 0 && chosen === null) {
        return null;
    }

    return (
        <>
            {available.length === 1 && (
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    data-slot="retro-bulk-export-button"
                    className="max-w-full min-w-0"
                    onClick={() => setChosen(available[0])}
                >
                    <Send aria-hidden />
                    <span className="truncate">
                        {t('Export to :provider', {
                            provider: available[0].label,
                        })}
                    </span>
                </Button>
            )}
            {available.length > 1 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-slot="retro-bulk-export-button"
                            className="max-w-full min-w-0"
                        >
                            <Send aria-hidden />
                            <span className="truncate">{t('Export')}</span>
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
                <BulkExportDialog
                    source={chosen}
                    scope={scope}
                    onClose={() => setChosen(null)}
                />
            )}
        </>
    );
}
