<?php

namespace App\Providers;

use App\Actions\Retros\GuestCookie;
use App\Actions\Whiteboards\WriteWhiteboardElements;
use App\Contracts\GamePresenceRoster;
use App\Contracts\PokerPresenceRoster;
use App\Events\Integrations\IntegrationActivated;
use App\Jobs\MatchIntegrationUsers;
use App\Mcp\McpGrant;
use App\Mcp\McpGrantContext;
use App\Mcp\McpTrackers;
use App\Mcp\VisibleTeams;
use App\Models\Passkey;
use App\Models\PersonalAccessToken;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\User;
use App\Models\Whiteboard;
use App\Policies\PokerDeckPolicy;
use App\Support\Auth\PasswordRule;
use App\Support\Auth\SignInPolicy;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\Games\DecodedRules;
use App\Support\Games\DrawAndGuessRules;
use App\Support\Games\GameRulesRegistry;
use App\Support\Games\GuessWhoRules;
use App\Support\Games\HangmanRules;
use App\Support\Games\MoodWeatherRules;
use App\Support\Games\QuickQuestionRules;
use App\Support\Games\ReverbGamePresenceRoster;
use App\Support\Games\SprintGifRules;
use App\Support\Games\TwoTruthsRules;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfigurationBaseline;
use App\Support\InstanceSettings;
use App\Support\Poker\ReverbPokerPresenceRoster;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\DevCommands;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Request;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\NotPwnedVerifier;
use Illuminate\Validation\Rules\Password;
use Laravel\Passkeys\Passkeys;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PokerPresenceRoster::class, fn (): PokerPresenceRoster => new ReverbPokerPresenceRoster);
        $this->app->bind(GamePresenceRoster::class, fn (): GamePresenceRoster => new ReverbGamePresenceRoster);
        $this->app->bind(GameRulesRegistry::class, fn (Application $app): GameRulesRegistry => new GameRulesRegistry([
            $app->make(HangmanRules::class),
            $app->make(DrawAndGuessRules::class),
            $app->make(DecodedRules::class),
            $app->make(SprintGifRules::class),
            $app->make(TwoTruthsRules::class),
            $app->make(MoodWeatherRules::class),
            $app->make(GuessWhoRules::class),
            $app->make(QuickQuestionRules::class),
        ]));
        $this->app->singleton(WriteWhiteboardElements::class);
        $this->app->scoped(McpGrantContext::class);
        $this->app->scoped(VisibleTeams::class);
        $this->app->scoped(McpTrackers::class);
        $this->app->scoped(InstanceSettings::class);
        $this->app->scoped(AvatarStyleCatalogue::class);
        $this->app->bind(McpGrant::class, fn (): McpGrant => McpGrant::current());
        $this->app->extend(UncompromisedVerifier::class, fn (UncompromisedVerifier $verifier, Application $app): UncompromisedVerifier => new NotPwnedVerifier(
            $app->make(HttpFactory::class),
            (int) config('skrum.passwords.breach_check_timeout'),
        ));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->app->instance(InstanceConfigurationBaseline::class, InstanceConfigurationBaseline::capture(new ConfigurationCatalogue));
        Markdown::withSecuredEncoding();
        Passkeys::usePasskeyModel(Passkey::class);
        Passkeys::authorizeLoginUsing(
            fn (): bool => resolve(SignInPolicy::class)->allowsLocalCredentials(),
        );
        Gate::policy(SavedPokerDeck::class, PokerDeckPolicy::class);
        Gate::define('manageInstance', fn (User $user): bool => $user->is_instance_admin === true);
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);
        RateLimiter::for('mcp', fn (Request $request): Limit => Limit::perMinute((int) config('skrum.mcp.rate_limit'))
            ->by('mcp-token:'.McpGrant::current()->tokenId));
        RateLimiter::for('whiteboard-writes', function (Request $request): Limit {
            $board = $request->route('board');
            $boardId = $board instanceof Whiteboard ? $board->id : (string) $board;

            $userId = Auth::id();
            $guestCookie = $request->cookie(GuestCookie::name(GuestCookie::WhiteboardScope, $boardId));
            $memberKey = match (true) {
                $userId !== null => "user:{$userId}",
                is_string($guestCookie) => 'guest:'.hash('sha256', $guestCookie),
                default => "ip:{$request->ip()}",
            };

            return Limit::perSecond(20)->by("{$memberKey}|{$boardId}");
        });

        /*
         * The throttle runs before the route bindings and ResolveRetroParticipant,
         * so the participant is read from the session user or the retro's guest cookie.
         */
        RateLimiter::for('retro-writing', function (Request $request): Limit {
            $retro = $request->route('retro');
            $retroId = $retro instanceof Retro ? $retro->id : (string) $retro;
            $userId = Auth::id();
            $guestCookie = $request->cookie(GuestCookie::name(GuestCookie::RetroScope, $retroId));
            $participantKey = match (true) {
                $userId !== null => "user:{$userId}",
                is_string($guestCookie) => 'guest:'.hash('sha256', $guestCookie),
                default => "ip:{$request->ip()}",
            };

            return Limit::perMinute(40)->by("retro-writing|{$retroId}|{$participantKey}");
        });

        Event::listen(IntegrationActivated::class, fn (IntegrationActivated $event) => MatchIntegrationUsers::start($event->integration));

        if ($this->app->environment('local')) {
            $reverbPort = (int) config('reverb.servers.reverb.port');

            DevCommands::artisan("reverb:start --host=0.0.0.0 --port={$reverbPort}", 'reverb');
        }
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => PasswordRule::defaults(
            app()->isProduction(),
            (bool) config('skrum.passwords.breach_check'),
        ));
    }
}
