<?php

use App\Enums\RetroPhase;
use App\Events\Retros\VoteCast;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Vote;
use App\Support\Database\Transactions;
use Illuminate\Database\Events\TransactionRolledBack;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Concurrency\Support\Race;

function votingRetro(int $votesPerParticipant = 3): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => $votesPerParticipant]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);

    return [$retro, $user, $participant, route('retros.cards.votes.store', [$retro, $card], false)];
}

it('never gives a participant more votes than the limit', function () {
    [, $user, $participant, $uri] = votingRetro();
    $userId = $user->id;

    $outcomes = Race::run(array_fill(0, 8, static fn (): int => Race::request($userId, 'POST', $uri)));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(3)
        ->and($statuses[201] ?? 0)->toBe(3)
        ->and($statuses[422] ?? 0)->toBe(5);
});

it('retries a vote that lost a deadlock, and records and broadcasts it once', function () {
    [$retro, $user, $participant, $uri] = votingRetro();
    $userId = $user->id;
    $retroId = $retro->id;
    $participantId = $participant->id;

    $outcomes = Race::run([
        'vote' => static function () use ($userId, $uri): array {
            $rollbacks = 0;
            $broadcasts = 0;

            Event::listen(TransactionRolledBack::class, function () use (&$rollbacks): void {
                $rollbacks++;
            });

            Event::listen(VoteCast::class, function () use (&$broadcasts): void {
                $broadcasts++;
            });

            return ['status' => Race::request($userId, 'POST', $uri), 'rollbacks' => $rollbacks, 'broadcasts' => $broadcasts];
        },
        'rival' => static fn (): bool => DB::transaction(static function () use ($retroId, $participantId): bool {
            Participant::query()->whereKey($participantId)->lockForUpdate()->firstOrFail()->touch();

            usleep(400_000);

            Retro::query()->whereKey($retroId)->lockForUpdate()->firstOrFail();

            return true;
        }),
    ]);

    expect($outcomes['rival'])->toMatchArray(['ok' => true, 'value' => true])
        ->and($outcomes['vote'])->toMatchArray(['ok' => true, 'value' => ['status' => 201, 'rollbacks' => 1, 'broadcasts' => 1]])
        ->and(Vote::query()->where('participant_id', $participantId)->count())->toBe(1);
})->skip(fn (): bool => config('database.default') === 'sqlite', 'SQLite takes its single write lock at BEGIN IMMEDIATE: two writers never hold locks in opposite orders, so no deadlock can be made.');

it('answers 503 with a retry delay when another connection holds the SQLite write lock past the busy timeout', function () {
    [$retro, $user, $participant, $uri] = votingRetro();
    $userId = $user->id;
    $retroId = $retro->id;

    $outcomes = Race::run([
        'holder' => static fn (): bool => DB::transaction(static function () use ($retroId): bool {
            Retro::query()->whereKey($retroId)->firstOrFail()->touch();

            usleep(6_500_000);

            return true;
        }),
        'vote' => static function () use ($userId, $uri): array {
            usleep(500_000);

            return Race::response($userId, 'POST', $uri);
        },
    ], Race::NoPause);

    expect($outcomes['holder'])->toMatchArray(['ok' => true, 'value' => true])
        ->and($outcomes['vote']['value']['status'])->toBe(503)
        ->and($outcomes['vote']['value']['headers'])->toMatchArray(['retry-after' => '1', strtolower(Transactions::BusyHeader) => rawurlencode(Transactions::busyMessage())])
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(0);
})->skip(fn (): bool => config('database.default') !== 'sqlite', 'On the server engines a writer waits for the row it needs, not for the whole database.');
