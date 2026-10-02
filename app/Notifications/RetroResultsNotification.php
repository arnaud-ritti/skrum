<?php

namespace App\Notifications;

use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Integrations\RetroResultsRecipients;
use App\Enums\RetroPhase;
use App\Mail\RetroResultsMail;
use App\Models\Retro;
use App\Models\User;
use App\Support\Integrations\Messages\RetroRecapMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

/**
 * Carries the retro id only: the recap is written when the mail is sent,
 * in the recipient's locale, and nobody who left the team receives it,
 * nor anyone once the retro has been reopened. The bell reads the retro
 * live from the same id.
 */
class RetroResultsNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public const string Kind = 'recap_ready';

    public function __construct(public string $retroId) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function shouldSend(object $notifiable, string $channel): bool
    {
        $retro = Retro::query()->with('team')->find($this->retroId);

        if ($retro === null || ! $notifiable instanceof User) {
            return false;
        }

        if ($retro->phase !== RetroPhase::Completed) {
            return false;
        }

        if ($channel === 'database' && ! $notifiable->recap_in_app) {
            return false;
        }

        return resolve(RetroResultsRecipients::class)->isRecipient($retro, $notifiable);
    }

    public function toMail(User $notifiable): RetroResultsMail
    {
        $retro = Retro::query()->with('team')->findOrFail($this->retroId);

        return resolve(RetroRecapMail::class)->build(
            resolve(BuildRetroRecap::class)->handle($retro),
            resolve(SummarizeHealthCheck::class)->handle($retro),
        )
            ->unsubscribeVia(URL::signedRoute('recapUnsubscribes.show', ['user' => $notifiable->id]))
            ->forNotifiable($notifiable);
    }

    /**
     * @return array{
     *     kind: string,
     *     retroId: string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return ['kind' => self::Kind, 'retroId' => $this->retroId];
    }
}
