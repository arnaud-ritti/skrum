<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\TopicNote;
use Tests\Concurrency\Support\Race;

it('creates one note when the first two saves of a topic arrive together', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$first] = retroMember($retro);
    [$second] = retroMember($retro);
    $topic = Card::factory()->create(['retro_id' => $retro->id]);
    $uri = route('retros.cards.notes.update', [$retro, $topic], false);
    $firstId = $first->id;
    $secondId = $second->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($firstId, 'PUT', $uri, ['body' => 'First', 'version' => 0]),
        static fn (): int => Race::request($secondId, 'PUT', $uri, ['body' => 'Second', 'version' => 0]),
    ]);

    // Protection: the retro row is locked before the note is read, so the second save sees version 1.
    expect(array_column($outcomes, 'value'))->toEqualCanonicalizing([200, 409])
        ->and(TopicNote::query()->count())->toBe(1)
        ->and(TopicNote::query()->sole()->version)->toBe(1);
});

it('keeps one of two saves made from the same version', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$first] = retroMember($retro);
    [$second] = retroMember($retro);
    $topic = Card::factory()->create(['retro_id' => $retro->id]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $topic->id, 'body' => 'Start', 'version' => 4]);
    $uri = route('retros.cards.notes.update', [$retro, $topic], false);
    $firstId = $first->id;
    $secondId = $second->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($firstId, 'PUT', $uri, ['body' => 'First', 'version' => 4]),
        static fn (): int => Race::request($secondId, 'PUT', $uri, ['body' => 'Second', 'version' => 4]),
    ]);

    $note = TopicNote::query()->sole();

    expect(array_column($outcomes, 'value'))->toEqualCanonicalizing([200, 409])
        ->and($note->version)->toBe(5)
        ->and($note->body)->toBeIn(['First', 'Second']);
});
