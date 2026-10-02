import { usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import {
    newItemToPayload,
    toActionItemData,
} from '@/components/action-items/action-item-adapters';
import type { NewActionItem } from '@/components/action-items/action-item-adapters';
import { ItemComments } from '@/components/action-items/item-comments';
import { ItemCreateForm } from '@/components/action-items/item-create-form';
import { ItemDeleteConfirm } from '@/components/action-items/item-delete-confirm';
import {
    ItemExport,
    ItemExportDialog,
} from '@/components/action-items/item-export';
import type { IntegrationScope } from '@/components/action-items/item-export';
import { ItemSubtasks } from '@/components/action-items/item-subtasks';
import {
    ActionItemMutationsContext,
    useActionItemMutations,
} from '@/components/action-items/use-action-item-mutations';
import { ActionItem } from '@/components/skrum/action-item';
import type { ActionItemOwner } from '@/components/skrum/action-item';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { boardActionItemEndpoints } from '@/lib/action-items/endpoints';
import {
    boardActionItemViewer,
    canManageActionItem,
} from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type {
    ActionItem as ActionItemPayload,
    Snapshot,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { ExportSource } from '@/types/integrations';
import { useBoard } from './board-context';

/**
 * Who an action item of the board can go to: the members who joined the
 * retro and its guests first, then the rest of the team. Workspace admins
 * outside the team cannot be assigned.
 */
export function boardOwnerOptions(
    board: Pick<Snapshot, 'participants' | 'teamMembers'>,
    labels: { inRetro: string; team: string },
): ActionItemOwner[] {
    const member = (
        person: Snapshot['teamMembers'][number],
        group: string,
    ): ActionItemOwner => ({
        id: person.id,
        name: person.name,
        kind: 'member',
        isTeamMember: true,
        avatarUrl: person.avatarUrl,
        group,
    });

    return [
        ...board.teamMembers
            .filter((person) => person.participantId !== null)
            .map((person) => member(person, labels.inRetro)),
        ...board.participants
            .filter((participant) => participant.isGuest)
            .map((participant): ActionItemOwner => ({
                id: participant.id,
                name: participant.name,
                kind: 'guest',
                avatarUrl: participant.avatarUrl,
                group: labels.inRetro,
            })),
        ...board.teamMembers
            .filter((person) => person.participantId === null)
            .map((person) => member(person, labels.team)),
    ];
}

type Props = {
    /** What a new item is attached to, such as the topic in focus (RT-8). */
    linkedTo?: ReactNode;
    className?: string;
};

/** The action items of the retro, with the form that creates one. */
export function ActionItemsList({ linkedTo, className }: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { board } = ctx;
    const retroId = board.retro.id;
    // Named by its heading: the suite finds the panel as the one aside
    // without an `aria-label`.
    const titleId = useId();
    const [creating, setCreating] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [openComments, setOpenComments] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState<ActionItemPayload | null>(null);
    const [ticket, setTicket] = useState<{
        item: ActionItemPayload;
        source: ExportSource;
    } | null>(null);
    const endpoints = useMemo(
        () => boardActionItemEndpoints(retroId),
        [retroId],
    );
    const viewer = boardActionItemViewer(board);
    const editable = ctx.isEditable;
    const members = boardOwnerOptions(board, {
        inRetro: t('In this retro'),
        team: t('Team'),
    });
    const scope: IntegrationScope | null =
        board.links.workspace === null || viewer.userId === null
            ? null
            : {
                  workspace: board.links.workspace,
                  canManagePeople: board.viewer.isWorkspaceManager,
              };

    const mutations = useActionItemMutations(
        endpoints,
        (actionItem) => ctx.apply({ type: 'actionItem.upsert', actionItem }),
        {
            run: ctx.run,
            onRemoved: (actionItemId) =>
                ctx.apply({ type: 'actionItem.remove', actionItemId }),
            onCommentCount: (actionItemId, commentCount) =>
                ctx.apply({
                    type: 'actionItem.comments',
                    actionItemId,
                    commentCount,
                    refresh: false,
                }),
        },
    );

    const create = async (
        values: NewActionItem,
    ): Promise<ActionItemPayload | boolean> => {
        const response = await ctx.run(
            retroRequest<{ actionItem: ActionItemPayload }>(
                ActionItemsController.store(retroId),
                newItemToPayload(values),
            ),
        );

        if (!response) {
            return false;
        }

        ctx.apply({
            type: 'actionItem.upsert',
            actionItem: response.actionItem,
        });

        return response.actionItem;
    };

    const toggleComments = (itemId: string): void =>
        setOpenComments((current) => {
            const next = new Set(current);

            if (!next.delete(itemId)) {
                next.add(itemId);
            }

            return next;
        });

    const ticketItem =
        ticket === null
            ? null
            : (board.actionItems.find((item) => item.id === ticket.item.id) ??
              ticket.item);

    return (
        <aside
            data-test="retro-action-items-panel"
            aria-labelledby={titleId}
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-card',
                className,
            )}
        >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <h2
                    id={titleId}
                    className="min-w-0 truncate text-base font-title"
                >
                    {t('Action items')}
                </h2>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-expanded={creating}
                    className={cn(
                        'max-w-full min-w-0',
                        creating &&
                            'border-primary/45 bg-skrum-primary-soft text-skrum-primary-text hover:bg-skrum-primary-soft',
                    )}
                    onClick={() => setCreating((current) => !current)}
                >
                    <Plus aria-hidden />
                    <span className="truncate">{t('Create an action')}</span>
                </Button>
            </div>
            <ActionItemMutationsContext value={mutations.value}>
                {board.actionItems.length === 0 ? (
                    <p className="text-body-sm text-muted-foreground">
                        {t('No action items yet.')}
                    </p>
                ) : (
                    <div role="list" className="flex min-w-0 flex-col gap-2">
                        {board.actionItems.map((item) => {
                            const { canComplete, ...data } = toActionItemData(
                                item,
                                { locale, viewer, sourceLabel: null },
                            );
                            const manages =
                                editable && canManageActionItem(item, viewer);
                            const completes = editable && canComplete;

                            return (
                                <ActionItem
                                    key={item.id}
                                    id={`action-item-${item.id}`}
                                    {...data}
                                    showOwnerName
                                    canComplete={completes}
                                    busy={mutations.busyId === item.id}
                                    editing={manages && editingId === item.id}
                                    commentsOpen={openComments.has(item.id)}
                                    onToggleComments={() =>
                                        toggleComments(item.id)
                                    }
                                    comments={
                                        <ItemComments
                                            item={item}
                                            endpoints={endpoints}
                                            revision={
                                                item.commentsRevision ?? 0
                                            }
                                            viewer={viewer}
                                            canWrite={editable}
                                            showAnonymousNotice={
                                                board.retro.isAnonymous
                                            }
                                        />
                                    }
                                    onStatusChange={(status) =>
                                        void mutations.setStatus(
                                            item,
                                            status === 'completed'
                                                ? 'completed'
                                                : 'open',
                                        )
                                    }
                                    {...(manages && {
                                        members,
                                        onEditStart: () =>
                                            setEditingId(item.id),
                                        onEditCancel: () => setEditingId(null),
                                        onChange: (patch) => {
                                            setEditingId(null);
                                            void mutations.patch(item, patch);
                                        },
                                        onDelete: () => setDeleting(item),
                                        onRetrySync: (link) =>
                                            void mutations.retrySync(
                                                item,
                                                link,
                                            ),
                                        actions:
                                            scope === null ? undefined : (
                                                <ItemExport
                                                    item={item}
                                                    sources={
                                                        board.exportSources
                                                    }
                                                    scope={scope}
                                                />
                                            ),
                                    })}
                                >
                                    {(manages || item.subtasks.length > 0) && (
                                        <ItemSubtasks
                                            item={item}
                                            endpoints={endpoints}
                                            canManage={manages}
                                            canComplete={completes}
                                        />
                                    )}
                                </ActionItem>
                            );
                        })}
                    </div>
                )}
                {creating && (
                    <ItemCreateForm
                        members={members}
                        disabled={!editable}
                        showAnonymousNotice={board.retro.isAnonymous}
                        linkedTo={linkedTo}
                        exportSources={
                            scope === null ? [] : board.exportSources
                        }
                        onCreate={create}
                        onCreatedWithTicket={(item, source) =>
                            setTicket({ item, source })
                        }
                        onCancel={() => setCreating(false)}
                    />
                )}
                {ticket !== null && ticketItem !== null && scope !== null && (
                    <ItemExportDialog
                        item={ticketItem}
                        source={ticket.source}
                        scope={scope}
                        onClose={() => setTicket(null)}
                    />
                )}
            </ActionItemMutationsContext>
            <ItemDeleteConfirm
                item={deleting}
                onCancel={() => setDeleting(null)}
                onConfirm={async (item) => {
                    await mutations.remove(item);
                    setDeleting(null);
                }}
            />
        </aside>
    );
}
