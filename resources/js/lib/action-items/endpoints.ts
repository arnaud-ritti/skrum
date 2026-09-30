import ActionItemCommentsController from '@/actions/App/Http/Controllers/Retros/ActionItemCommentsController';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import WorkspaceActionItemCommentsController from '@/actions/App/Http/Controllers/WorkspaceActionItemCommentsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';

export type EndpointRoute = { url: string; method: string };

/**
 * The same card talks to the board endpoints (own retro, phase rules) or
 * to the workspace endpoints (carry-over panel, global page).
 */
export type ActionItemEndpoints = {
    update: (actionItemId: string) => EndpointRoute;
    destroy: (actionItemId: string) => EndpointRoute;
    comments: (actionItemId: string) => EndpointRoute;
    addComment: (actionItemId: string) => EndpointRoute;
    updateComment: (commentId: string) => EndpointRoute;
    destroyComment: (commentId: string) => EndpointRoute;
};

export function boardActionItemEndpoints(retroId: string): ActionItemEndpoints {
    return {
        update: (actionItem) =>
            ActionItemsController.update({ retro: retroId, actionItem }),
        destroy: (actionItem) =>
            ActionItemsController.destroy({ retro: retroId, actionItem }),
        comments: (actionItem) =>
            ActionItemCommentsController.index({ retro: retroId, actionItem }),
        addComment: (actionItem) =>
            ActionItemCommentsController.store({ retro: retroId, actionItem }),
        updateComment: (actionItemComment) =>
            ActionItemCommentsController.update({
                retro: retroId,
                actionItemComment,
            }),
        destroyComment: (actionItemComment) =>
            ActionItemCommentsController.destroy({
                retro: retroId,
                actionItemComment,
            }),
    };
}

export function workspaceActionItemEndpoints(
    workspace: string,
): ActionItemEndpoints {
    return {
        update: (actionItem) =>
            WorkspaceActionItemsController.update({ workspace, actionItem }),
        destroy: (actionItem) =>
            WorkspaceActionItemsController.destroy({ workspace, actionItem }),
        comments: (actionItem) =>
            WorkspaceActionItemCommentsController.index({
                workspace,
                actionItem,
            }),
        addComment: (actionItem) =>
            WorkspaceActionItemCommentsController.store({
                workspace,
                actionItem,
            }),
        updateComment: (actionItemComment) =>
            WorkspaceActionItemCommentsController.update({
                workspace,
                actionItemComment,
            }),
        destroyComment: (actionItemComment) =>
            WorkspaceActionItemCommentsController.destroy({
                workspace,
                actionItemComment,
            }),
    };
}
