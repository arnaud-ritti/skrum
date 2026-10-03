<?php

namespace App\Actions\Mcp;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RevokeMcpToken
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    public function handle(User $user, PersonalAccessToken $token): void
    {
        abort_unless(
            $token->tokenable_type === $user->getMorphClass() && $token->tokenable_id === $user->id,
            404,
        );

        DB::transaction(function () use ($user, $token): void {
            $token->delete();

            $this->recordAuditEvent->handle(AuditAction::TokenRevoked, $user, $token, ['name' => $token->name]);
        });
    }
}
