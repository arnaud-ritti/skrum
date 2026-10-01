<?php

namespace App\Actions\Integrations;

use App\Contracts\DeliverySubject;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\NotConnected;
use App\Jobs\Integrations\DeliverToMattermost;
use App\Jobs\Integrations\DeliverToMicrosoftTeams;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Jobs\Integrations\DeliverToWebhook;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Messages\ShareContent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class QueueShare
{
    public function __construct(private StoreWebhookPayload $storeWebhookPayload) {}

    public function requireIntegration(Team $team, IntegrationProvider $provider): TeamIntegration
    {
        $integration = $provider->isEnabled() ? $team->integration($provider) : null;

        throw_if($integration === null, NotConnected::class, $provider);

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

        $integration = $this->requireIntegration($team, $provider);
        $locale = app()->getLocale();

        $occurredAt = now()->toIso8601ZuluString();

        $event = $provider === IntegrationProvider::Webhook ? $this->webhookEvent($kind) : null;
        $webhookData = $provider === IntegrationProvider::Webhook ? $content->toWebhook() : [];

        $makeJob = match ($provider) {
            IntegrationProvider::Slack => fn (string $id): DeliverToSlack => new DeliverToSlack($id, $content->toSlack(), $locale),
            IntegrationProvider::Telegram => fn (string $id): DeliverToTelegram => new DeliverToTelegram($id, $content->toTelegram(), $locale),
            IntegrationProvider::MicrosoftTeams => fn (string $id): DeliverToMicrosoftTeams => new DeliverToMicrosoftTeams($id, $content->toMicrosoftTeams(), $locale),
            IntegrationProvider::Mattermost => fn (string $id): DeliverToMattermost => new DeliverToMattermost($id, $content->toMattermost(), $locale),
            IntegrationProvider::Webhook => fn (string $id): DeliverToWebhook => new DeliverToWebhook($id, (string) $event, $occurredAt, $webhookData, $locale),
            default => throw new InvalidArgumentException("{$provider->value} is not a share channel."),
        };

        $delivery = DB::transaction(function () use ($team, $channel, $kind, $integration, $event, $subject, $requester, $occurredAt, $webhookData): IntegrationDelivery {
            $delivery = IntegrationDelivery::query()->create([
                'team_id' => $team->id,
                'channel' => $channel,
                'kind' => $kind,
                'team_integration_id' => $integration->id,
                'event' => $event,
                'subject_type' => $subject->getMorphClass(),
                'subject_id' => $subject->getKey(),
                'requested_by_user_id' => $requester->id,
                'status' => IntegrationDeliveryStatus::Queued,
            ]);

            if ($event !== null) {
                $this->storeWebhookPayload->keepIfPossible($delivery, [
                    'id' => $delivery->id,
                    'event' => $event,
                    'occurredAt' => $occurredAt,
                    'data' => $webhookData,
                ]);
            }

            return $delivery;
        });

        $job = $makeJob($delivery->id);

        dispatch($job)->afterCommit();

        return $delivery;
    }

    private function webhookEvent(IntegrationDeliveryKind $kind): string
    {
        return match ($kind) {
            IntegrationDeliveryKind::RetroLink => 'retro.link',
            IntegrationDeliveryKind::PokerLink => 'poker.link',
            IntegrationDeliveryKind::RetroResults => 'retro.results',
            IntegrationDeliveryKind::GameRoomLink => 'game_room.link',
            IntegrationDeliveryKind::Event => throw new InvalidArgumentException('Automatic events are not shares.'),
        };
    }
}
