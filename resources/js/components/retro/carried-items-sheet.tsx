import { Link, usePage } from '@inertiajs/react';
import { History } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ownerOptions } from '@/components/action-items/action-item-adapters';
import { ItemDeleteConfirm } from '@/components/action-items/item-delete-confirm';
import type { IntegrationScope } from '@/components/action-items/item-export';
import {
    ActionItemMutationsContext,
    useActionItemMutations,
} from '@/components/action-items/use-action-item-mutations';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem, Snapshot } from '@/lib/retro/types';
import { ActionItemRows } from './action-item-rows';
import { useBoard } from './board-context';

const OutsideRetro = 'outside';

type CarriedGroup = {
    key: string;
    title: string;
    createdAt: string | null;
    items: ActionItem[];
};

/**
 * One group per source retro, newest retro first, items in server order;
 * items added outside a retro come last.
 */
export function groupCarriedActionItems(items: ActionItem[]): CarriedGroup[] {
    const groups = new Map<string, CarriedGroup>();

    for (const item of items) {
        const key = item.retroId ?? OutsideRetro;
        const group = groups.get(key) ?? {
            key,
            title: item.source?.retroTitle ?? '',
            createdAt: item.source?.retroCreatedAt ?? null,
            items: [],
        };

        groups.set(key, { ...group, items: [...group.items, item] });
    }

    return [...groups.values()].sort((first, second) => {
        if (first.key === OutsideRetro) {
            return 1;
        }

        if (second.key === OutsideRetro) {
            return -1;
        }

        return (second.createdAt ?? '').localeCompare(first.createdAt ?? '');
    });
}

/**
 * The follow-ups of earlier retros are for the members of the team, on a
 * retro that is still open, and only when there is one.
 */
export function showsCarriedItems(
    board: Pick<Snapshot, 'viewer' | 'links' | 'retro' | 'carriedActionItems'>,
): boolean {
    return (
        !board.viewer.isGuest &&
        board.links.workspace !== null &&
        board.retro.phase !== 'completed' &&
        board.carriedActionItems.length > 0
    );
}

type RowsProps = {
    items: ActionItem[];
    /** The DOM id of a row; two lists of the same items never share one. */
    idPrefix: string;
    /** Left out where a heading already names the retro of the items. */
    showSource?: boolean;
};

/**
 * Follow-ups of earlier retros, changed through the routes of the workspace:
 * the board routes only know the items of this retro.
 */
export function CarriedItemRows({
    items,
    idPrefix,
    showSource = false,
}: RowsProps) {
    const ctx = useBoard();
    const { locale } = usePage().props;
    const { board } = ctx;
    const workspace = board.links.workspace ?? '';
    const [deleting, setDeleting] = useState<ActionItem | null>(null);
    const endpoints = useMemo(
        () => workspaceActionItemEndpoints(workspace),
        [workspace],
    );
    const viewer = boardActionItemViewer(board);
    const scope: IntegrationScope | null =
        board.links.workspace === null || viewer.userId === null
            ? null
            : {
                  workspace: board.links.workspace,
                  canManagePeople: board.viewer.isWorkspaceManager,
              };

    const mutations = useActionItemMutations(
        endpoints,
        (actionItem) =>
            ctx.apply({ type: 'carriedActionItem.upsert', actionItem }),
        {
            run: ctx.run,
            onRemoved: (actionItemId) =>
                ctx.apply({ type: 'carriedActionItem.remove', actionItemId }),
            onCommentCount: (actionItemId, commentCount) =>
                ctx.apply({
                    type: 'actionItem.comments',
                    actionItemId,
                    commentCount,
                    refresh: false,
                }),
        },
    );

    return (
        <ActionItemMutationsContext value={mutations.value}>
            <ActionItemRows
                items={items}
                endpoints={endpoints}
                mutations={mutations}
                viewer={viewer}
                editable
                members={ownerOptions(board.teamMembers)}
                scope={scope}
                exportSources={board.exportSources}
                locale={locale}
                showAnonymousNotice={board.retro.isAnonymous}
                idFor={(item) => `${idPrefix}${item.id}`}
                {...(!showSource && { sourceLabel: null })}
                onDelete={setDeleting}
            />
            <ItemDeleteConfirm
                item={deleting}
                onCancel={() => setDeleting(null)}
                onConfirm={async (item) => {
                    await mutations.remove(item);
                    setDeleting(null);
                }}
            />
        </ActionItemMutationsContext>
    );
}

/**
 * "Previous action items": the open follow-ups of the team, in a sheet that
 * opens by itself the first time a member sees the board in Writing.
 */
export function CarriedItemsSheet() {
    const { board, sessionExpired } = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [open, setOpen] = useState(false);
    const restoreFocus = useRestoreFocus(open);
    const firstPhase = useRef(board.retro.phase);
    const items = board.carriedActionItems;
    const openCount = items.filter((item) => item.status === 'open').length;
    const available = showsCarriedItems(board);

    useEffect(() => {
        if (!available || firstPhase.current !== 'writing') {
            return;
        }

        const key = `skrum.carriedSeen.${board.retro.id}`;

        try {
            if (window.localStorage.getItem(key) !== null) {
                return;
            }

            window.localStorage.setItem(key, 'true');
        } catch {
            return;
        }

        setOpen(true);
    }, [available, board.retro.id]);

    if (!available) {
        return null;
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-w-full min-w-0"
                onClick={() => setOpen(true)}
            >
                <History aria-hidden />
                <span className="truncate">
                    {t('Previous action items (:count)', { count: openCount })}
                </span>
            </Button>
            <Sheet open={open && !sessionExpired} onOpenChange={setOpen}>
                <SheetContent
                    data-slot="retro-carried-items"
                    className="sm:max-w-lg"
                    onCloseAutoFocus={restoreFocus}
                >
                    <SheetHeader>
                        <SheetTitle>{t('Previous action items')}</SheetTitle>
                        <SheetDescription>
                            {t(
                                'Open follow-ups from earlier retrospectives of this team.',
                            )}
                        </SheetDescription>
                    </SheetHeader>
                    <SheetBody className="flex flex-col gap-6 space-y-0">
                        {groupCarriedActionItems(items).map((group) => (
                            <section
                                key={group.key}
                                className="flex min-w-0 flex-col gap-2"
                            >
                                <h3 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                                    <span className="min-w-0 wrap-anywhere">
                                        {group.key === OutsideRetro
                                            ? t('Added outside a retro')
                                            : group.title}
                                    </span>
                                    {group.createdAt && (
                                        <span className="font-normal text-muted-foreground">
                                            {formatShortDate(
                                                group.createdAt,
                                                locale,
                                            )}
                                        </span>
                                    )}
                                </h3>
                                <CarriedItemRows
                                    items={group.items}
                                    idPrefix="action-item-"
                                />
                            </section>
                        ))}
                        {board.carriedActionItemsHasMore &&
                            board.links.actionItems && (
                                <p className="text-body-sm">
                                    <Link
                                        href={board.links.actionItems}
                                        className="rounded-xs underline-offset-4 outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                                    >
                                        {t('View all on the action items page')}
                                    </Link>
                                </p>
                            )}
                    </SheetBody>
                    {board.links.actionItems && (
                        <SheetFooter>
                            <Button
                                variant="secondary"
                                asChild
                                className="max-w-full min-w-0"
                            >
                                <Link href={board.links.actionItems}>
                                    <span className="truncate">
                                        {t('Open the action items page')}
                                    </span>
                                </Link>
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
