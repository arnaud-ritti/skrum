<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationProvider;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\IntegrationAvailability;

class ShareOptions
{
    private const NoChannels = ['slack' => false, 'telegram' => false];

    public function __construct(
        private SharePermissions $sharePermissions,
        private IntegrationAvailability $integrationAvailability,
    ) {}

    /**
     * @return array{slack: bool, telegram: bool}
     */
    public function channels(Team $team): array
    {
        $team->loadMissing('integrations');

        return [
            'slack' => $this->isActive($team, IntegrationProvider::Slack),
            'telegram' => $this->isActive($team, IntegrationProvider::Telegram),
        ];
    }

    /**
     * @return array{slack: bool, telegram: bool, email: bool}
     */
    public function retro(Retro $retro, Participant $viewer): array
    {
        if (! $this->sharePermissions->retro($retro, $viewer)) {
            return [...self::NoChannels, 'email' => false];
        }

        return [...$this->channels($retro->team), 'email' => $this->integrationAvailability->emailEnabled()];
    }

    /**
     * @return array{slack: bool, telegram: bool}
     */
    public function pokerGame(PokerGame $game, PokerPlayer $viewer): array
    {
        if ($game->isEnded() || ! $this->sharePermissions->pokerGame($game, $viewer)) {
            return self::NoChannels;
        }

        return $this->channels($game->team);
    }

    private function isActive(Team $team, IntegrationProvider $provider): bool
    {
        if (! $provider->isEnabled()) {
            return false;
        }

        return $team->integrations->contains(
            fn (TeamIntegration $integration): bool => $integration->provider === $provider && $integration->isActive(),
        );
    }
}
