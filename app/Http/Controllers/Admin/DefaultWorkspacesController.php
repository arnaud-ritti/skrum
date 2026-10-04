<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
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
            if ($settings->defaultWorkspaceId() === $workspaceId) {
                return;
            }

            $settings->set(InstanceSettingKey::DefaultWorkspace->value, $workspaceId);

            $recordAuditEvent->handle(AuditAction::SettingsUpdated, $request->user(), null, ['section' => 'sign_in', 'keys' => [InstanceSettingKey::DefaultWorkspace->value]]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Default workspace saved.')]);

        return to_route('admin.signIn.edit');
    }
}
