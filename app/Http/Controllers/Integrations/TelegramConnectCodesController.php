<?php

namespace App\Http\Controllers\Integrations;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramConnectCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TelegramConnectCodesController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team, TelegramConnectCodes $codes, TelegramBot $bot): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $username = $bot->username();

        throw_if($username === null, ProviderUnavailable::class, IntegrationProvider::Telegram, 'getMe failed');

        $issued = $codes->issue($team, $request->user());

        return response()->json([
            'code' => $issued['code'],
            'command' => "/connect@{$username} {$issued['code']}",
            'botUsername' => $username,
            'expiresAt' => $issued['expiresAt']->toIso8601String(),
        ]);
    }
}
