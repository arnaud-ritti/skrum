<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationInboundMode;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\TeamIntegration;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\Trackers\JiraIssueTracker;

/**
 * The single place that decides whether the estimate of an imported task
 * can be written back, and which write-back state it shows (spec 6 §6.5,
 * §6.6). Built once per game so presenting many tasks costs one query.
 */
class PokerTaskSync
{
    public const Synced = 'synced';

    public const Pending = 'pending';

    public const Failed = 'failed';

    public const Unsupported = 'unsupported';

    /**
     * @param  array<string, ?TeamIntegration>  $integrations  keyed by tracker provider value
     */
    private function __construct(private PokerGame $game, private array $integrations) {}

    public static function for(PokerGame $game): self
    {
        $game->loadMissing('team.integrations');

        $integrations = [];

        foreach (self::trackerProviders() as $provider) {
            $integrations[$provider->value] = $provider->isEnabled()
                ? $game->team->integrations->first(fn (TeamIntegration $integration): bool => $integration->provider === $provider)
                : null;
        }

        return new self($game, $integrations);
    }

    /**
     * @return array<int, IntegrationProvider>
     */
    public static function trackerProviders(): array
    {
        return array_values(array_filter(
            IntegrationProvider::cases(),
            fn (IntegrationProvider $provider): bool => $provider->isTracker(),
        ));
    }

    public function integration(string $source): ?TeamIntegration
    {
        return $this->integrations[$source] ?? null;
    }

    /**
     * The connections as the room shows them: the facilitator's write-back
     * setting needs the Jira fields an estimate can go to.
     *
     * @return array<string, array{
     *     connected: bool,
     *     canWrite: bool,
     *     estimateFields: list<array{id: string, name: string}>,
     *     defaultEstimateFieldId: ?string
     * }|null>
     */
    public function summary(): array
    {
        $summary = [];

        foreach (self::trackerProviders() as $provider) {
            $integration = $this->integrations[$provider->value] ?? null;

            $summary[$provider->value] = $provider->isEnabled() ? [
                'connected' => $integration?->isActive() ?? false,
                'canWrite' => $integration?->canWrite() ?? false,
                'estimateFields' => $integration === null ? [] : ListPokerSources::estimateFields($integration),
                'defaultEstimateFieldId' => $integration === null ? null : ListPokerSources::defaultEstimateFieldId($integration),
            ] : null;
        }

        return $summary;
    }

    /**
     * GitHub keeps the card label as text, so every deck can be written
     * (spec 8 §4.2); Jira and Linear hold numbers only.
     */
    public static function writesAnyDeck(IntegrationProvider $provider): bool
    {
        return $provider === IntegrationProvider::GitHub;
    }

    public function unsupportedReason(PokerTask $task): ?string
    {
        if (! $this->game->writes_estimates) {
            return __('Estimates are not written back in this game.');
        }

        $provider = IntegrationProvider::tryFrom((string) $task->external_source);

        if ($provider === null || ! $provider->isTracker()) {
            return __('This task can no longer be synced.');
        }

        $integration = $this->integrations[$provider->value] ?? null;

        $connectionReason = self::connectionReason($provider, $integration);

        if ($connectionReason !== null) {
            return $connectionReason;
        }

        if ($integration?->site() !== $task->external_site) {
            return __('This task comes from another :provider site.', ['provider' => $provider->label()]);
        }

        $accessReason = self::accessReason($provider, $integration);

        if ($accessReason !== null) {
            return $accessReason;
        }

        if (! $this->game->isNumeric() && ! self::writesAnyDeck($provider)) {
            return __("T-shirt estimates can't be written to :source.", ['source' => $provider->label()]);
        }

        return self::storyPointsReason($provider, $integration, $this->game->estimate_field_id);
    }

    /**
     * Why estimates of this connection can never be written back,
     * whatever the task or game.
     */
    public static function writeBackUnavailableReason(IntegrationProvider $provider, ?TeamIntegration $integration): ?string
    {
        return self::connectionReason($provider, $integration)
            ?? self::accessReason($provider, $integration)
            ?? self::storyPointsReason($provider, $integration);
    }

    private static function connectionReason(IntegrationProvider $provider, ?TeamIntegration $integration): ?string
    {
        $label = ['provider' => $provider->label()];

        if ($integration?->status === IntegrationStatus::ReconnectRequired) {
            return __('Reconnect :provider in the team settings.', $label);
        }

        if ($integration === null || ! $integration->isActive()) {
            return __('Connect :provider in the team settings.', $label);
        }

        return null;
    }

    private static function accessReason(IntegrationProvider $provider, ?TeamIntegration $integration): ?string
    {
        if ($integration?->access !== IntegrationAccess::Write) {
            return __('This :provider connection is read-only.', ['provider' => $provider->label()]);
        }

        return null;
    }

    /**
     * A game that names a number field the connection lists has a field to
     * write to, even when no story points field was detected.
     */
    private static function storyPointsReason(IntegrationProvider $provider, ?TeamIntegration $integration, ?string $preferredFieldId = null): ?string
    {
        if ($integration === null || ! in_array($provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true)) {
            return null;
        }

        if (JiraIssueTracker::storyPointFieldIds($integration) !== []) {
            return null;
        }

        if ($preferredFieldId !== null && self::listsNumberField($integration, $preferredFieldId)) {
            return null;
        }

        return __('No story points field found.');
    }

    private static function listsNumberField(TeamIntegration $integration, string $fieldId): bool
    {
        return array_any((array) $integration->setting('numberFields', []), fn($field): bool => is_array($field) && ($field['id'] ?? null) === $fieldId);
    }

    public function state(PokerTask $task): ?string
    {
        if ($task->external_source === null) {
            return null;
        }

        if ($this->unsupportedReason($task) !== null) {
            return self::Unsupported;
        }

        if ($task->needs_sync && $task->sync_error !== null) {
            return self::Failed;
        }

        if ($task->needs_sync) {
            return self::Pending;
        }

        return $task->synced_at !== null ? self::Synced : null;
    }

    public function syncMode(PokerTask $task): string
    {
        $integration = $task->external_source === null ? null : $this->integration($task->external_source);

        if ($integration === null || ! StatusSync::isOn($integration) || $integration->site() !== $task->external_site) {
            return IntegrationInboundMode::Off->value;
        }

        return $integration->inbound_mode->value;
    }

    /**
     * Spec 8 §5.8: the source estimate changed after the last write-back
     * (or after the import) and differs from skrum's. Nothing is flagged
     * while a write-back is on its way or cannot happen, nor in an ended
     * game, where the facilitator can no longer act on it.
     *
     * @return array{sourceEstimate: string, matchingCard: ?string}|null
     */
    public function estimateConflict(PokerTask $task): ?array
    {
        $provider = IntegrationProvider::tryFrom((string) $task->external_source);

        if ($provider === null || $task->estimate === null || $task->external_estimate === null) {
            return null;
        }

        if ($this->game->isEnded()) {
            return null;
        }

        if (self::sameEstimate($provider, $task->estimate, $task->external_estimate)) {
            return null;
        }

        if (in_array($this->state($task), [self::Pending, self::Unsupported], true)) {
            return null;
        }

        $baseline = $task->synced_at ?? $task->created_at;

        if ($task->external_updated_at === null || ($baseline !== null && $task->external_updated_at->lte($baseline))) {
            return null;
        }

        return [
            'sourceEstimate' => $task->external_estimate,
            'matchingCard' => self::matchingCard($this->game, $provider, $task->external_estimate),
        ];
    }

    /**
     * The deck card holding the source's value: the same number for Jira
     * and Linear, the same label (case-sensitive) for GitHub.
     */
    public static function matchingCard(PokerGame $game, IntegrationProvider $provider, string $sourceEstimate): ?string
    {
        foreach ($game->cards as $card) {
            if (! PokerDeck::isSpecial($card) && self::sameEstimate($provider, $card, $sourceEstimate)) {
                return $card;
            }
        }

        return null;
    }

    private static function sameEstimate(IntegrationProvider $provider, string $skrum, string $source): bool
    {
        if ($skrum === $source) {
            return true;
        }

        if (self::writesAnyDeck($provider)) {
            return false;
        }

        $number = PokerDeck::numericValue($skrum);

        return $number !== null && $number === PokerDeck::numericValue($source);
    }
}
