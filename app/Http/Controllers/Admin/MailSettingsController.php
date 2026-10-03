<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\ConfigurationChange;
use App\Actions\Admin\PresentMailSettings;
use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\MailSettingsUpdateRequest;
use App\Support\Auth\PasswordConfirmation;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MailSettingsController extends Controller
{
    public function show(Request $request, PresentMailSettings $presentMailSettings, InstanceSettings $settings, PasswordConfirmation $confirmation): Response
    {
        return Inertia::render('admin/mail', [
            'mail' => $presentMailSettings->handle(),
            'lastTest' => $settings->mailLastTest(),
            'defaultRecipient' => $request->user()->email,
            'confirmedUntil' => $confirmation->freshUntil($request, InstanceConfiguration::ConfirmationSeconds),
            'confirmUrl' => route('admin.mailConfirmation.create'),
            'updateUrl' => route('admin.mail.update'),
        ]);
    }

    public function update(MailSettingsUpdateRequest $request, UpdateInstanceConfiguration $update): RedirectResponse
    {
        $change = $update->handle($request->user(), $request->section(), $request->values(), $request->clear(), $request->ip());

        Inertia::flash('toast', $this->toast($change));

        return to_route('admin.mail.show');
    }

    /** @return array{type: string, message: string} */
    private function toast(ConfigurationChange $change): array
    {
        if ($change->isEmpty()) {
            return ['type' => 'info', 'message' => __('Nothing to save.')];
        }

        if ($change->alertSent === false) {
            return ['type' => 'warning', 'message' => __('Saved, but the alert to the admins could not be sent.')];
        }

        return ['type' => 'success', 'message' => __(':provider settings saved. Every instance admin gets an e-mail.', ['provider' => 'SMTP'])];
    }
}
