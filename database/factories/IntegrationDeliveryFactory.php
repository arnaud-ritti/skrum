<?php

namespace Database\Factories;

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Models\IntegrationDelivery;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Model;

/**
 * @extends Factory<IntegrationDelivery>
 */
class IntegrationDeliveryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'channel' => IntegrationDeliveryChannel::Slack,
            'kind' => IntegrationDeliveryKind::RetroLink,
            'subject_type' => (new Retro)->getMorphClass(),
            'subject_id' => fn (array $attributes) => Retro::factory()->create(['team_id' => $attributes['team_id']])->id,
            'status' => IntegrationDeliveryStatus::Queued,
        ];
    }

    public function forSubject(Model $subject): static
    {
        return $this->state(fn () => [
            'team_id' => $subject->getAttribute('team_id'),
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'kind' => $subject instanceof PokerGame ? IntegrationDeliveryKind::PokerLink : IntegrationDeliveryKind::RetroLink,
        ]);
    }

    public function sent(): static
    {
        return $this->state(fn () => ['status' => IntegrationDeliveryStatus::Sent, 'sent_at' => now()]);
    }

    public function failed(string $error = 'boom'): static
    {
        return $this->state(fn () => ['status' => IntegrationDeliveryStatus::Failed, 'error' => $error]);
    }
}
