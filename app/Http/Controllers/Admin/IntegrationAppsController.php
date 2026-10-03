<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\ConfigurationChange;
use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\IntegrationAppUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class IntegrationAppsController extends Controller
{
    public function update(IntegrationAppUpdateRequest $request, string $provider, UpdateInstanceConfiguration $update): RedirectResponse
    {
        $change = $update->handle($request->user(), $request->section(), $request->values(), $request->clear(), $request->ip());

        Inertia::flash('toast', $this->toast($change, $request->provider()));

        return to_route('admin.integrations.edit');
    }

    /** @return array{type: string, message: string} */
    private function toast(ConfigurationChange $change, IntegrationProvider $provider): array
    {
        if ($change->isEmpty()) {
            return ['type' => 'info', 'message' => __('Nothing to save.')];
        }

        return ['type' => 'success', 'message' => __(':provider settings saved.', ['provider' => $provider->label()])];
    }
}
