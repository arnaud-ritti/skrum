<?php

use App\Models\Card;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameUsedWord;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;

it('counts the votes of each card of a retro, and those of one participant', function () {
    $retro = Retro::factory()->create();
    [$first, $second, $silent] = Card::factory()->count(3)->create(['retro_id' => $retro->id]);
    $ada = Participant::factory()->create(['retro_id' => $retro->id]);
    $bob = Participant::factory()->create(['retro_id' => $retro->id]);

    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $first->id, 'participant_id' => $ada->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $first->id, 'participant_id' => $bob->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $second->id, 'participant_id' => $bob->id]);

    expect($retro->voteCountsByCard()->all())->toEqualCanonicalizing([$first->id => 3, $second->id => 1])
        ->and($retro->voteCountsByCard()->get($first->id))->toBe(3)
        ->and($retro->voteCountsByCard($ada)->all())->toBe([$first->id => 2])
        ->and($retro->voteCountsByCard()->has($silent->id))->toBeFalse();
});

it('counts the votes of a retro with one query however many cards voted', function () {
    $retro = Retro::factory()->create();
    Card::factory()->count(5)->create(['retro_id' => $retro->id])
        ->each(fn (Card $card) => Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]));

    DB::enableQueryLog();
    $retro->voteCountsByCard();

    expect(DB::getQueryLog())->toHaveCount(1);
});

it('sums the points, wins and rounds of a player through its relation', function () {
    $player = GamePlayer::factory()->create();
    GamePoint::factory()->create(['game_room_id' => $player->game_room_id, 'player_id' => $player->id, 'points' => 3, 'is_win' => true]);
    GamePoint::factory()->create(['game_room_id' => $player->game_room_id, 'player_id' => $player->id, 'points' => 2, 'is_win' => false]);

    $read = GamePlayer::query()->whereKey($player->id)
        ->withSum('points as total_points', 'points')
        ->withCount(['points as wins' => fn ($points) => $points->where('is_win', true), 'points as rounds_played'])
        ->sole();

    expect((int) $read->total_points)->toBe(5)
        ->and((int) $read->wins)->toBe(1)
        ->and((int) $read->rounds_played)->toBe(2);
});

it('records a used word once, whoever asks twice', function () {
    $team = Team::factory()->create();
    $key = ['team_id' => $team->id, 'locale' => 'fr', 'word' => 'pêche'];

    GameUsedWord::query()->firstOrCreate($key);
    DB::transaction(fn () => GameUsedWord::query()->createOrFirst($key));

    expect(GameUsedWord::query()->where($key)->count())->toBe(1);
});
