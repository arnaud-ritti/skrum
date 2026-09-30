import RetroActionItemExportPreviewsController from '@/actions/App/Http/Controllers/Integrations/RetroActionItemExportPreviewsController';
import RetroActionItemExportsController from '@/actions/App/Http/Controllers/Integrations/RetroActionItemExportsController';
import WorkspaceActionItemExportPreviewsController from '@/actions/App/Http/Controllers/Integrations/WorkspaceActionItemExportPreviewsController';
import WorkspaceActionItemExportsController from '@/actions/App/Http/Controllers/Integrations/WorkspaceActionItemExportsController';
import ActionItemCommentsController from '@/actions/App/Http/Controllers/Retros/ActionItemCommentsController';
import ActionItemSubtasksController from '@/actions/App/Http/Controllers/Retros/ActionItemSubtasksController';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import WorkspaceActionItemCommentsController from '@/actions/App/Http/Controllers/WorkspaceActionItemCommentsController';
import WorkspaceActionItemSubtasksController from '@/actions/App/Http/Controllers/WorkspaceActionItemSubtasksController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import type { TrackerProviderKey } from '@/types/integrations';

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
    addSubtask: (actionItemId: string) => EndpointRoute;
    updateSubtask: (subtaskId: string) => EndpointRoute;
    destroySubtask: (subtaskId: string) => EndpointRoute;
    exportItem: (actionItemId: string) => EndpointRoute;
    exportPreview: (
        actionItemId: string,
        source: TrackerProviderKey,
    ) => EndpointRoute;
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
        addSubtask: (actionItem) =>
            ActionItemSubtasksController.store({ retro: retroId, actionItem }),
        updateSubtask: (actionItemSubtask) =>
            ActionItemSubtasksController.update({
                retro: retroId,
                actionItemSubtask,
            }),
        destroySubtask: (actionItemSubtask) =>
            ActionItemSubtasksController.destroy({
                retro: retroId,
                actionItemSubtask,
            }),
        exportItem: (actionItem) =>
            RetroActionItemExportsController.store({
                retro: retroId,
                actionItem,
            }),
        exportPreview: (actionItem, source) =>
            RetroActionItemExportPreviewsController.show(
                { retro: retroId, actionItem },
                { query: { source } },
            ),
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
        addSubtask: (actionItem) =>
            WorkspaceActionItemSubtasksController.store({
                workspace,
                actionItem,
            }),
        updateSubtask: (actionItemSubtask) =>
            WorkspaceActionItemSubtasksController.update({
                workspace,
                actionItemSubtask,
            }),
        destroySubtask: (actionItemSubtask) =>
            WorkspaceActionItemSubtasksController.destroy({
                workspace,
                actionItemSubtask,
            }),
        exportItem: (actionItem) =>
            WorkspaceActionItemExportsController.store({
                workspace,
                actionItem,
            }),
        exportPreview: (actionItem, source) =>
            WorkspaceActionItemExportPreviewsController.show(
                { workspace, actionItem },
                { query: { source } },
            ),
    };
}
