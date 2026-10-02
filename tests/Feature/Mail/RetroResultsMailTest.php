<?php

use App\Enums\RetroPhase;
use App\Mail\RetroResultsMail;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Notifications\RetroResultsNotification;

it('returns the branded mailable with the facts of the retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42']);
    [$facilitator] = retroFacilitator($retro);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    expect($mail)->toBeInstanceOf(RetroResultsMail::class)
        ->and($mail->hasTo($facilitator->email))->toBeTrue()
        ->and($mail->subject)->toBe("Sprint 42 · {$retro->team->name} — no action");
    $mail->assertSeeInHtml('Open the full summary');
});

it('escapes user text and shows no backslash', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint_42 <b>']);
    [$facilitator] = retroFacilitator($retro);
    ActionItem::factory()->create(['retro_id' => $retro->id, 'team_id' => $retro->team_id, 'content' => 'Ship [it](https://evil.test) *now*']);

    $html = (string) (new RetroResultsNotification($retro->id))->toMail($facilitator)->render();

    expect($html)->toContain('Ship [it](https://evil.test) *now*')
        ->not->toContain('href="https://evil.test"')
        ->not->toContain('\\*')
        ->not->toContain('<b>');
});

it('links to the notification settings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    $mail->assertSeeInHtml(route('notificationPreferences.edit'), false);
});
