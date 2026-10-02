<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Integrations\BuildRetroRecap;
use App\Enums\ActionItemReminderKind;
use App\Enums\RetroPhase;
use App\Mail\MagicLinkMail;
use App\Mail\TwoFactorCodeMail;
use App\Mail\WorkspaceInvitationMail;
use App\Models\ActionItem;
use App\Models\EmailTwoFactorCode;
use App\Models\MagicLink;
use App\Models\Retro;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Support\Integrations\Messages\RetroRecapMail;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Mail\Mailable;

class MailPreviewsController extends Controller
{
    public function show(Request $request, string $mail): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);

        $sample = $this->samples()[$mail] ?? null;

        abort_if($sample === null, 404);

        $mailable = $sample();

        abort_if($mailable === null, 404);

        $locale = $request->query('locale');

        if (in_array($locale, config('skrum.locales'), true)) {
            $mailable->locale($locale);
        }

        return response($mailable->render());
    }

    /**
     * @return array<string, Closure(): ?Mailable>
     */
    private function samples(): array
    {
        return [
            'invitation' => fn (): Mailable => (new WorkspaceInvitationMail('Nordlys', 'Fran Facilitator', url('/invitations/sample'), now()->addDays(7)))
                ->subject(__('You are invited to join :workspace', ['workspace' => 'Nordlys'])),
            'action-reminder' => fn (): ?Mailable => ($user = User::query()->whereHas('teams')->first()) === null
                ? null
                : (new ActionItemReminderDigestNotification(
                    ActionItem::query()->whereIn('team_id', $user->teams()->select('teams.id'))->limit(3)->pluck('id')
                        ->map(fn (string $id): array => ['actionItemId' => $id, 'kind' => ActionItemReminderKind::Overdue->value])->all(),
                ))->toMail($user),
            'retro-recap' => fn (): ?Mailable => ($retro = Retro::query()->where('phase', RetroPhase::Completed)->latest()->first()) === null
                ? null
                : resolve(RetroRecapMail::class)->build(
                    resolve(BuildRetroRecap::class)->handle($retro),
                    resolve(SummarizeHealthCheck::class)->handle($retro),
                ),
            'magic-link' => fn (): Mailable => new MagicLinkMail(url('/magic-link/'.str_repeat('a', 64).'?expires=0&signature=sample'), 'ada@example.com', MagicLink::LifetimeMinutes),
            'two-factor-code' => fn (): Mailable => new TwoFactorCodeMail('042917', EmailTwoFactorCode::LifetimeMinutes, 'Firefox · macOS'),
        ];
    }
}
