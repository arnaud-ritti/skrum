<?php

use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Retros\BuildSummaryInput;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\TopicNote;
use App\Models\Vote;
use App\Support\Integrations\Messages\RetroRecapMail;

function notedRetro(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $quiet = topicCard($retro, ['content' => 'Flaky CI', 'position' => 0]);
    $loud = topicCard($retro, ['content' => 'Scope changes mid-sprint', 'position' => 1]);
    $empty = topicCard($retro, ['content' => 'Client demo', 'position' => 2]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $loud->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $quiet->id]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $quiet->id, 'body' => 'Quarantine the flaky tests.']);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $loud->id, 'body' => str_repeat('One in, one out. ', 30)]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $empty->id, 'body' => '   ']);

    return [$retro, $quiet, $loud];
}

it('puts the notes of the topics in the recap, by votes, cut, without blank notes', function () {
    [$retro] = notedRetro();

    $recap = resolve(BuildRetroRecap::class)->handle($retro);

    expect($recap->topicNotes)->toHaveCount(2)
        ->and($recap->topicNotes[0]['title'])->toBe('Scope changes mid-sprint')
        ->and(mb_strlen($recap->topicNotes[0]['note']))->toBeLessThanOrEqual(BuildRetroRecap::TopicNoteLength + 1)
        ->and($recap->topicNotes[0]['note'])->toEndWith('…')
        ->and($recap->topicNotes[1])->toBe(['title' => 'Flaky CI', 'note' => 'Quarantine the flaky tests.']);
});

it('gives the recap e-mail a Discussion notes section', function () {
    [$retro] = notedRetro();

    $mail = resolve(RetroRecapMail::class)->build(resolve(BuildRetroRecap::class)->handle($retro), null);

    expect(collect($mail->sections)->pluck('heading')->all())->toContain('Discussion notes');
});

it('gives the AI summary input the note of each lead card', function () {
    [$retro] = notedRetro();

    $input = resolve(BuildSummaryInput::class)->handle($retro);
    $cards = collect(json_decode($input->payload, true)['cards']);

    expect($cards->firstWhere('text', 'Flaky CI')['notes'])->toBe('Quarantine the flaky tests.')
        ->and($cards->firstWhere('text', 'Client demo'))->not->toHaveKey('notes');
});
