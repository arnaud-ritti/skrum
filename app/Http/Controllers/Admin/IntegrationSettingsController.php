<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\PresentIntegrationSettings;
use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\InstanceSettingKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\IntegrationSettingsUpdateRequest;
use App\Support\Auth\PasswordConfirmation;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class IntegrationSettingsController extends Controller
{
    public function edit(Request $request, PresentIntegrationSettings $presentIntegrationSettings, PasswordConfirmation $confirmation, InstanceSettings $settings): Response
    {
        return Inertia::render('admin/integrations', [
            'providers' => $presentIntegrationSettings->handle(),
            'disabled' => $settings->disabledIntegrations(),
            'confirmedUntil' => $confirmation->freshUntil($request, InstanceConfiguration::ConfirmationSeconds),
            'confirmUrl' => route('admin.integrationConfirmation.create'),
        ]);
    }

    public function update(IntegrationSettingsUpdateRequest $request, InstanceSettings $settings, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        DB::transaction(function () use ($request, $settings, $recordAuditEvent): void {
            $before = $settings->disabledIntegrations();

            $settings->set(InstanceSettingKey::DisabledIntegrations->value, $request->disabled());

            $after = $settings->disabledIntegrations();

            if ($after === $before) {
                return;
            }

            $recordAuditEvent->handle(AuditAction::SettingsUpdated, $request->user(), null, [
                'section' => 'integrations',
                'keys' => [InstanceSettingKey::DisabledIntegrations->value],
                'disabled' => $after,
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Integration settings saved.')]);

        return to_route('admin.integrations.edit');
    }
}
