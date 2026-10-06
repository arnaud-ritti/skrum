import { usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import { newItemToPayload } from '@/components/action-items/action-item-adapters';
import type { NewActionItem } from '@/components/action-items/action-item-adapters';
import { ItemCreateForm } from '@/components/action-items/item-create-form';
import { ItemDeleteConfirm } from '@/components/action-items/item-delete-confirm';
import { ItemExportDialog } from '@/components/action-items/item-export';
import type { IntegrationScope } from '@/components/action-items/item-export';
import {
    ActionItemMutationsContext,
    useActionItemMutations,
} from '@/components/action-items/use-action-item-mutations';
import type { ActionItemOwner } from '@/components/skrum/action-item';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollapsibleBlock } from '@/components/ui/collapsible';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTrans } from '@/hooks/use-trans';
import { boardActionItemEndpoints } from '@/lib/action-items/endpoints';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type {
    ActionItem as ActionItemPayload,
    Snapshot,
} from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { ExportSource } from '@/types/integrations';
import { ActionItemRows } from './action-item-rows';
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

/** The topic a new item is linked to, and the line of the form that says so (RT-8). */
export type ActionItemLink = {
    cardId: string;
    label: ReactNode;
    /** The link can be removed before creating, for that item only. */
    unlinkable?: boolean;
};

type Props = {
    /** What a new item is attached to, such as the topic in focus (RT-8). */
    linkedTo?: ActionItemLink;
    /** The title of the panel; "Action items" by default. */
    title?: string;
    /**
     * Lists only the items it keeps; the others of the retro go, folded,
     * under "Other action items (n)", so that none disappears (RT-8).
     */
    filter?: (item: ActionItemPayload) => boolean;
    /**
     * `phase` is the card of the Actions phase: the count, what the list is
     * for, the form first and always open, "Action created" with its Undo.
     */
    variant?: 'panel' | 'phase';
    /** Place of what acts on the whole list, such as "Export to Jira" (RT-10). */
    headerActions?: ReactNode;
    /** Place of the topic an item belongs to (RT-8). */
    itemMeta?: (item: ActionItemPayload) => ReactNode;
    /** Items listed with those of the retro and counted with them. */
    more?: { count: number; node: ReactNode };
    className?: string;
};

/** The action items of the retro, with the form that creates one. */
export function ActionItemsList({
    linkedTo,
    title,
    filter,
    variant = 'panel',
    headerActions,
    itemMeta,
    more,
    className,
}: Props) {
    const ctx = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { board } = ctx;
    const retroId = board.retro.id;
    const isPhase = variant === 'phase';
    // Named by its heading: the suite finds the panel as the one aside
    // without an `aria-label`.
    const titleId = useId();
    const isMobile = useIsMobile();
    const [creating, setCreating] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);
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
    const stillEditable = useRef(editable && !ctx.sessionExpired);

    useEffect(() => {
        stillEditable.current = editable && !ctx.sessionExpired;
    });
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

        const { actionItem } = response;

        ctx.apply({ type: 'actionItem.upsert', actionItem });

        if (isPhase) {
            setCreatedId(actionItem.id);
            // The toast is the opposite of a confirmation: for a few
            // seconds, one press takes the item back.
            toast.success(t('Action created'), {
                description: actionItem.assignee?.name,
                action: {
                    label: t('Undo'),
                    onClick: () => {
                        if (stillEditable.current) {
                            void mutations.remove(actionItem);
                        }
                    },
                },
            });
        }

        return actionItem;
    };

    const ticketItem =
        ticket === null
            ? null
            : (board.actionItems.find((item) => item.id === ticket.item.id) ??
              ticket.item);
    const count = board.actionItems.length + (more?.count ?? 0);
    const listed =
        filter === undefined
            ? board.actionItems
            : board.actionItems.filter((item) => filter(item));
    const others =
        filter === undefined
            ? []
            : board.actionItems.filter((item) => !filter(item));

    const form = (isMobile || isPhase || creating) && (
        <ItemCreateForm
            layout={isMobile ? 'stacked' : 'inline'}
            members={members}
            disabled={!editable}
            showAnonymousNotice={board.retro.isAnonymous}
            linkedTo={
                linkedTo === undefined ? (
                    isPhase &&
                    !isMobile && (
                        <span className="truncate">{t('Quick add')}</span>
                    )
                ) : (
                    <span className="flex min-w-0 items-center gap-1 truncate">
                        {linkedTo.label}
                    </span>
                )
            }
            cardId={linkedTo?.cardId}
            unlinkable={linkedTo?.unlinkable}
            exportSources={scope === null ? [] : board.exportSources}
            onCreate={
                isMobile
                    ? async (values) => {
                          const created = await create(values);

                          if (created !== false) {
                              setDrawerOpen(false);
                          }

                          return created;
                      }
                    : create
            }
            onCreatedWithTicket={(item, source) => setTicket({ item, source })}
            onCancel={
                isPhase || isMobile ? undefined : () => setCreating(false)
            }
        />
    );
    // On a phone the form is a drawer, opened from one button.
    const formPlace = isMobile ? (
        <>
            {isPhase && (
                <Button
                    type="button"
                    size="lg"
                    aria-haspopup="dialog"
                    aria-expanded={drawerOpen}
                    className="w-full min-w-0"
                    onClick={() => setDrawerOpen(true)}
                >
                    <Plus aria-hidden />
                    <span className="truncate">{t('Create an action')}</span>
                </Button>
            )}
            <Drawer
                open={drawerOpen && !ctx.sessionExpired}
                onOpenChange={setDrawerOpen}
            >
                <DrawerContent
                    aria-describedby={undefined}
                    data-slot="retro-action-drawer"
                    className="scrollbar-themed overflow-y-auto"
                >
                    <DrawerHeader className="pr-10 text-left">
                        <DrawerTitle>{t('New action item')}</DrawerTitle>
                    </DrawerHeader>
                    {form}
                </DrawerContent>
            </Drawer>
        </>
    ) : (
        form
    );

    const rows = (shown: ActionItemPayload[]) => (
        <ActionItemRows
            items={shown}
            endpoints={endpoints}
            mutations={mutations}
            viewer={viewer}
            editable={editable}
            members={members}
            scope={scope}
            exportSources={board.exportSources}
            locale={locale}
            showAnonymousNotice={board.retro.isAnonymous}
            sourceLabel={null}
            idFor={(item) => `action-item-${item.id}`}
            classNameFor={(item) =>
                item.id === createdId ? 'ring-2 ring-skrum-success' : undefined
            }
            metaFor={itemMeta}
            onDelete={setDeleting}
        />
    );

    const items =
        count === 0 ? (
            <p className="text-body-sm text-muted-foreground">
                {t('No action items yet.')}
            </p>
        ) : (
            <>
                {listed.length > 0 && rows(listed)}
                {more?.node}
            </>
        );

    const otherItems = others.length > 0 && (
        <div data-slot="retro-other-action-items" className="min-w-0">
            <CollapsibleBlock
                trigger={{
                    label: t('Other action items (:count)', {
                        count: others.length,
                    }),
                }}
            >
                {rows(others)}
            </CollapsibleBlock>
        </div>
    );

    return (
        <aside
            data-test="retro-action-items-panel"
            data-variant={variant}
            aria-labelledby={titleId}
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-card',
                isPhase && 'gap-4 p-4 md:p-6',
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <h2
                        id={titleId}
                        className={cn(
                            'flex min-w-0 items-center gap-2 text-base font-title',
                            isPhase && 'text-lg',
                        )}
                    >
                        <span className="truncate">
                            {title ??
                                (isPhase
                                    ? t('Retro actions')
                                    : t('Action items'))}
                        </span>
                        {isPhase && (
                            <Badge variant="muted" shape="pill">
                                {count}
                            </Badge>
                        )}
                    </h2>
                    {headerActions}
                    {!isPhase && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-haspopup={isMobile ? 'dialog' : undefined}
                            aria-expanded={isMobile ? drawerOpen : creating}
                            className={cn(
                                'max-w-full min-w-0',
                                isMobile && 'h-11',
                                !isMobile &&
                                    creating &&
                                    'border-primary/45 bg-skrum-primary-soft text-skrum-primary-text hover:bg-skrum-primary-soft',
                            )}
                            onClick={() =>
                                isMobile
                                    ? setDrawerOpen(true)
                                    : setCreating((current) => !current)
                            }
                        >
                            <Plus aria-hidden />
                            <span className="truncate">
                                {t('Create an action')}
                            </span>
                        </Button>
                    )}
                </div>
                {isPhase && (
                    <p className="text-body-sm text-muted-foreground">
                        {t(
                            'Give each action an owner and a due date. They stay visible on the action items page of the team.',
                        )}
                    </p>
                )}
            </div>
            <ActionItemMutationsContext value={mutations.value}>
                {isPhase && formPlace}
                {items}
                {!isPhase && formPlace}
                {otherItems}
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
