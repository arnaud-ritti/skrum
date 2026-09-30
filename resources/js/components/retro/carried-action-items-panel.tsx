import { Link, usePage } from '@inertiajs/react';
import { History } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionItemCard } from '@/components/action-items/action-item-card';
import { teamAssigneeGroups } from '@/components/action-items/assignee-select';
import type { ExportContext } from '@/components/action-items/export-action-item-button';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem } from '@/lib/retro/types';
import { useBoard } from './board-context';

const OutsideRetro = 'outside';

export type CarriedGroup = {
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

export function CarriedActionItemsPanel() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { board } = ctx;
    const [open, setOpen] = useState(false);
    const firstPhase = useRef(board.retro.phase);
    const workspace = board.links.workspace;
    const endpoints = useMemo(
        () => workspaceActionItemEndpoints(workspace ?? ''),
        [workspace],
    );
    const items = board.carriedActionItems;
    const openCount = items.filter((item) => item.status === 'open').length;
    const available =
        !board.viewer.isGuest &&
        workspace !== null &&
        board.retro.phase !== 'completed' &&
        items.length > 0;

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

    const viewer = boardActionItemViewer(board);
    const groups = teamAssigneeGroups(board.teamMembers, t);
    const exportContext: ExportContext | undefined =
        workspace === null
            ? undefined
            : {
                  workspace,
                  sources: board.exportSources,
                  canManagePeople: board.viewer.isWorkspaceManager,
              };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <History className="size-4" />
                {t('Previous action items (:count)', { count: openCount })}
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle>{t('Previous action items')}</SheetTitle>
                        <SheetDescription>
                            {t(
                                'Open follow-ups from earlier retrospectives of this team.',
                            )}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 px-4">
                        {groupCarriedActionItems(items).map((group) => (
                            <section key={group.key} className="space-y-2">
                                <h3 className="text-sm font-semibold">
                                    {group.key === OutsideRetro
                                        ? t('Added outside a retro')
                                        : group.title}
                                    {group.createdAt && (
                                        <span className="ml-2 font-normal text-muted-foreground">
                                            {formatShortDate(
                                                group.createdAt,
                                                locale,
                                            )}
                                        </span>
                                    )}
                                </h3>
                                <ul className="space-y-2">
                                    {group.items.map((item) => (
                                        <ActionItemCard
                                            key={item.id}
                                            item={item}
                                            endpoints={endpoints}
                                            viewer={viewer}
                                            assigneeGroups={groups}
                                            run={ctx.run}
                                            editable
                                            showAnonymousNotice={
                                                board.retro.isAnonymous
                                            }
                                            exportContext={exportContext}
                                            onSaved={(actionItem) =>
                                                ctx.apply({
                                                    type: 'carriedActionItem.upsert',
                                                    actionItem,
                                                })
                                            }
                                            onRemoved={(actionItemId) =>
                                                ctx.apply({
                                                    type: 'carriedActionItem.remove',
                                                    actionItemId,
                                                })
                                            }
                                            onCommentCount={(
                                                actionItemId,
                                                commentCount,
                                            ) =>
                                                ctx.apply({
                                                    type: 'actionItem.comments',
                                                    actionItemId,
                                                    commentCount,
                                                    refresh: false,
                                                })
                                            }
                                        />
                                    ))}
                                </ul>
                            </section>
                        ))}
                        {board.carriedActionItemsHasMore &&
                            board.links.actionItems && (
                                <p className="text-sm">
                                    <Link
                                        href={board.links.actionItems}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        {t('View all on the action items page')}
                                    </Link>
                                </p>
                            )}
                    </div>
                    {board.links.actionItems && (
                        <SheetFooter>
                            <Button variant="secondary" asChild>
                                <Link href={board.links.actionItems}>
                                    {t('Open the action items page')}
                                </Link>
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
