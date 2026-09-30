import { useMemo } from 'react';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import { ActionItemCard } from '@/components/action-items/action-item-card';
import { ActionItemForm } from '@/components/action-items/action-item-form';
import { boardAssigneeGroups } from '@/components/action-items/assignee-select';
import { useTrans } from '@/hooks/use-trans';
import { boardActionItemEndpoints } from '@/lib/action-items/endpoints';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { RotiControl } from './roti-control';

export function ActionItemsPanel() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { board } = ctx;
    const endpoints = useMemo(
        () => boardActionItemEndpoints(board.retro.id),
        [board.retro.id],
    );
    const viewer = boardActionItemViewer(board);
    const groups = boardAssigneeGroups(board, t);

    const create = async (
        payload: Record<string, unknown>,
    ): Promise<boolean> => {
        const response = await ctx.run(
            retroRequest<{ actionItem: ActionItem }>(
                ActionItemsController.store(board.retro.id),
                payload,
            ),
        );

        if (!response) {
            return false;
        }

        ctx.apply({
            type: 'actionItem.upsert',
            actionItem: response.actionItem,
        });

        return true;
    };

    return (
        <aside className="w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-4 lg:max-h-dvh lg:w-80 lg:self-start lg:overflow-y-auto">
            <h2 className="text-sm font-semibold">{t('Action items')}</h2>
            <ActionItemForm
                assigneeGroups={groups}
                disabled={!ctx.isEditable}
                showAnonymousNotice={board.retro.isAnonymous}
                submitLabel={t('Add')}
                onSubmit={create}
            />
            {board.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {board.actionItems.map((item) => (
                        <ActionItemCard
                            key={item.id}
                            item={item}
                            endpoints={endpoints}
                            viewer={viewer}
                            assigneeGroups={groups}
                            run={ctx.run}
                            editable={ctx.isEditable}
                            showAnonymousNotice={board.retro.isAnonymous}
                            onSaved={(actionItem) =>
                                ctx.apply({
                                    type: 'actionItem.upsert',
                                    actionItem,
                                })
                            }
                            onRemoved={(actionItemId) =>
                                ctx.apply({
                                    type: 'actionItem.remove',
                                    actionItemId,
                                })
                            }
                            onCommentCount={(actionItemId, commentCount) =>
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
            )}
            <div className="border-t pt-3">
                <RotiControl />
            </div>
        </aside>
    );
}
