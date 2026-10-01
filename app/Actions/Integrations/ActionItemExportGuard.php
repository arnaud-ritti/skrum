<?php

namespace App\Actions\Integrations;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\Rule;

class ActionItemExportGuard
{
    /**
     * Trackers that take exported action items; the enum value is the `source`.
     */
    public const Sources = ['jira', 'jira_dc', 'linear', 'github'];

    public function __construct(private ActionItemPermissions $permissions) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function sourceRules(): array
    {
        return ['source' => ['required', 'string', Rule::in(self::Sources)]];
    }

    public function authorize(ActionItem $item, ActionItemActor $actor): User
    {
        $user = $actor->user;

        if ($user === null) {
            throw new AuthorizationException(__('Guests cannot export action items.'));
        }

        $this->permissions->authorizeEdit($item, $actor);

        return $user;
    }

    public function integration(Team $team, string $source): TeamIntegration
    {
        $provider = IntegrationProvider::from($source);

        abort_unless($provider->isEnabled(), 404);

        $integration = $team->integration($provider);

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureWritable();

        return $integration;
    }
}
