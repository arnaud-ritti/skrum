<?php

namespace App\Providers;

use App\Contracts\PokerPresenceRoster;
use App\Models\Passkey;
use App\Models\SavedPokerDeck;
use App\Policies\PokerDeckPolicy;
use App\Support\Poker\ReverbPokerPresenceRoster;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\DevCommands;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Passkeys\Passkeys;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PokerPresenceRoster::class, fn (): PokerPresenceRoster => new ReverbPokerPresenceRoster);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        Markdown::withSecuredEncoding();
        Passkeys::usePasskeyModel(Passkey::class);
        Gate::policy(SavedPokerDeck::class, PokerDeckPolicy::class);

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

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
