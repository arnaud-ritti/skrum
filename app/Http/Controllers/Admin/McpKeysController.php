<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\PresentMcpKeys;
use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Http\Controllers\Controller;
use App\Models\PersonalAccessToken;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class McpKeysController extends Controller
{
    public function index(PresentMcpKeys $presentMcpKeys): Response
    {
        return Inertia::render('admin/mcp-keys', [
            'keys' => $presentMcpKeys->handle(),
            'mcpEnabled' => (bool) config('skrum.mcp.enabled'),
            'createUrl' => route('apiTokens.index'),
        ]);
    }

    public function destroy(Request $request, PersonalAccessToken $token, RecordAuditEvent $recordAuditEvent): RedirectResponse
    {
        DB::transaction(function () use ($request, $token, $recordAuditEvent): void {
            $recordAuditEvent->handle(AuditAction::TokenRevokedByAdmin, $request->user(), $token, [
                'owner' => $token->tokenable_id,
                'name' => $token->name,
            ]);

            $token->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Token revoked.')]);

        return back();
    }
}
