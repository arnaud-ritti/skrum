<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DefaultWorkspaceUpdateRequest;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DefaultWorkspacesController extends Controller
{
    public function update(DefaultWorkspaceUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        $workspaceId = $request->validated('default_workspace_id');

        DB::transaction(function () use ($settings, $recordAuditEvent, $request, $workspaceId): void {
            $settings->set('default_workspace', $workspaceId);
            $recordAuditEvent->handle(AuditAction::SettingsUpdated, $request->user(), null, ['section' => 'sign_in', 'keys' => ['default_workspace']]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Default workspace saved.')]);

        return to_route('admin.signIn.edit');
    }
}
