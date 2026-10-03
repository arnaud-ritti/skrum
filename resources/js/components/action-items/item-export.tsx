import { Link } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import {
    EmptyExportTarget,
    ExportTargetFields,
    exportTargetBody,
} from '@/components/action-items/export-target-fields';
import type {
    ExportTarget,
    IntegrationScope,
} from '@/components/action-items/export-target-fields';
import { useActionItemMutationsValue } from '@/components/action-items/use-action-item-mutations';
import { LoadingButton } from '@/components/skrum/loading-button';
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
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type {
    ExportPreview,
    ExportSource,
    ExportWarning,
} from '@/types/integrations';

export type { IntegrationScope };

/** Several provider calls run in one export (spec §7): wait longer. */
export const ExportTimeoutMs = 45_000;

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
    const [target, setTarget] = useState<ExportTarget>(EmptyExportTarget);
    const [ready, setReady] = useState(false);
    const [preview, setPreview] = useState<ExportPreview | null>(null);
    const [busy, setBusy] = useState(false);
    const isGitHub = source.source === 'github';
    const previewUrl = endpoints.exportPreview(item.id, source.source).url;

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
                }>(
                    endpoints.exportItem(item.id),
                    exportTargetBody(source.source, target),
                    { timeoutMs: ExportTimeoutMs },
                ),
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
                <ExportTargetFields
                    source={source}
                    scope={scope}
                    teamId={item.teamId}
                    value={target}
                    onChange={setTarget}
                    disabled={busy}
                    onReadyChange={setReady}
                />
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
