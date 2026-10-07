<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Enums\InstanceSettingKey;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\LlmSettingsUpdateRequest;
use App\Support\Auth\PasswordConfirmation;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\Llm\Llm;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LlmSettingsController extends Controller
{
    public function edit(Request $request, InstanceConfiguration $configuration, PasswordConfirmation $confirmation, Llm $llm): Response
    {
        return Inertia::render('admin/ai', [
            'fields' => $configuration->describe(InstanceSettingKey::Llm),
            'configured' => $llm->isConfigured(),
            'confirmedUntil' => $confirmation->freshUntil($request, InstanceConfiguration::ConfirmationSeconds),
        ]);
    }

    public function update(LlmSettingsUpdateRequest $request, UpdateInstanceConfiguration $update): RedirectResponse
    {
        $change = $update->handle($request->user(), $request->section(), $request->values(), $request->clear(), $request->ip());

        Inertia::flash('toast', ['type' => $change->isEmpty() ? 'info' : 'success', 'message' => $change->isEmpty() ? __('Nothing to save.') : __('AI settings saved.')]);

        return to_route('admin.ai.edit');
    }
}
