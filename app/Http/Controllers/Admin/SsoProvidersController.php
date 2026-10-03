<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\ConfigurationChange;
use App\Actions\Admin\UpdateInstanceConfiguration;
use App\Enums\SsoProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SsoProviderUpdateRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class SsoProvidersController extends Controller
{
    public function update(SsoProviderUpdateRequest $request, string $provider, UpdateInstanceConfiguration $update): RedirectResponse
    {
        $change = $update->handle($request->user(), $request->section(), $request->values(), $request->clear(), $request->ip());

        Inertia::flash('toast', $this->toast($change, $request->provider()));

        return to_route('admin.signIn.edit');
    }

    /** @return array{type: string, message: string} */
    private function toast(ConfigurationChange $change, SsoProvider $provider): array
    {
        if ($change->isEmpty()) {
            return ['type' => 'info', 'message' => __('Nothing to save.')];
        }

        if ($change->alertSent === false) {
            return ['type' => 'warning', 'message' => __('Saved, but the alert to the admins could not be sent.')];
        }

        return ['type' => 'success', 'message' => __(':provider settings saved. Every instance admin gets an e-mail.', ['provider' => $provider->label()])];
    }
}
