<?php

namespace App\Providers;

use App\Models\Participant;
use App\Models\Passkey;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\DevCommands;
use Illuminate\Http\Request;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
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
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        Markdown::withSecuredEncoding();
        Passkeys::usePasskeyModel(Passkey::class);

        RateLimiter::for('gif-search', function (Request $request): Limit {
            $participant = $request->attributes->get('participant');

            return Limit::perMinute(20)->by($participant instanceof Participant ? $participant->id : (string) $request->ip());
        });

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
