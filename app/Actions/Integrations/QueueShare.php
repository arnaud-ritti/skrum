<?php

namespace App\Actions\Integrations;

use App\Contracts\DeliverySubject;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\DeliverToMattermost;
use App\Jobs\Integrations\DeliverToMicrosoftTeams;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\NotConnected;
use App\Support\Integrations\Messages\ShareContent;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

class QueueShare
{
    public function requireIntegration(Team $team, IntegrationProvider $provider): TeamIntegration
    {
        $integration = $provider->isEnabled() ? $team->integration($provider) : null;

        if ($integration === null) {
            throw new NotConnected($provider);
        }

        $integration->ensureActive();

        return $integration;
    }

    public function handle(
        Model&DeliverySubject $subject,
        IntegrationDeliveryChannel $channel,
        IntegrationDeliveryKind $kind,
        User $requester,
        ShareContent $content,
    ): IntegrationDelivery {
        $provider = $channel->provider() ?? throw new InvalidArgumentException('Email is not a share channel.');
        $team = $subject->deliveryTeam();

        $this->requireIntegration($team, $provider);

        $delivery = IntegrationDelivery::query()->create([
            'team_id' => $team->id,
            'channel' => $channel,
            'kind' => $kind,
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'requested_by_user_id' => $requester->id,
            'status' => IntegrationDeliveryStatus::Queued,
        ]);

        $locale = app()->getLocale();

        $job = match ($provider) {
            IntegrationProvider::Slack => new DeliverToSlack($delivery->id, $content->toSlack(), $locale),
            IntegrationProvider::Telegram => new DeliverToTelegram($delivery->id, $content->toTelegram(), $locale),
            IntegrationProvider::MicrosoftTeams => new DeliverToMicrosoftTeams($delivery->id, $content->toMicrosoftTeams(), $locale),
            IntegrationProvider::Mattermost => new DeliverToMattermost($delivery->id, $content->toMattermost(), $locale),
            default => throw new InvalidArgumentException("{$provider->value} is not a share channel."),
        };

        dispatch($job)->afterCommit();

        return $delivery;
    }
}
