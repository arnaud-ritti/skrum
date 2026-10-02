<?php

use App\Models\Card;
use App\Models\CardReaction;
use App\Models\Participant;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Support\Facades\DB;

it('keeps two different emoji of one participant on one card, and removes only the one asked', function () {
    $card = Card::factory()->create();
    $participant = Participant::factory()->create(['retro_id' => $card->retro_id]);
    $reaction = fn (string $emoji): array => ['retro_id' => $card->retro_id, 'card_id' => $card->id, 'participant_id' => $participant->id, 'emoji' => $emoji];

    CardReaction::factory()->create($reaction('👍'));
    CardReaction::factory()->create($reaction('🎉'));

    expect(CardReaction::query()->where('card_id', $card->id)->where('emoji', '👍')->count())->toBe(1);

    CardReaction::query()->where('card_id', $card->id)->where('participant_id', $participant->id)->where('emoji', '👍')->delete();

    expect(CardReaction::query()->where('card_id', $card->id)->pluck('emoji')->all())->toBe(['🎉']);
});

it('finds the reaction that exists rather than taking another emoji for it', function () {
    $card = Card::factory()->create();
    $participant = Participant::factory()->create(['retro_id' => $card->retro_id]);
    CardReaction::factory()->create(['retro_id' => $card->retro_id, 'card_id' => $card->id, 'participant_id' => $participant->id, 'emoji' => '👍']);

    $card->reactions()->firstOrCreate(['participant_id' => $participant->id, 'emoji' => '🎉'], ['retro_id' => $card->retro_id]);

    expect($card->reactions()->count())->toBe(2);
});

it('tells apart two token names that differ by case', function () {
    $user = User::factory()->create();
    $user->createToken('Ada');
    $user->createToken('ada');

    expect($user->tokens()->where('name', 'ada')->count())->toBe(1)
        ->and($user->tokens()->count())->toBe(2);
});

it('tells apart words that differ by an accent, by case, or by a trailing space, in a key', function () {
    $team = Team::factory()->create();

    foreach (['peche', 'pêche', 'péché', 'Peche', 'a', 'a '] as $word) {
        DB::table('game_used_words')->insert(['team_id' => $team->id, 'locale' => 'fr', 'word' => $word, 'created_at' => now()]);
    }

    expect(DB::table('game_used_words')->where('team_id', $team->id)->count())->toBe(6)
        ->and(DB::table('game_used_words')->where('team_id', $team->id)->where('word', 'peche')->count())->toBe(1)
        ->and(DB::table('game_used_words')->where('team_id', $team->id)->where('word', 'a')->count())->toBe(1);
});

it('tells apart two whiteboard element ids that differ by case', function () {
    $board = Whiteboard::factory()->create();

    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'AbC123']);
    WhiteboardElement::factory()->create(['whiteboard_id' => $board->id, 'element_id' => 'abc123']);

    expect(DB::table('whiteboard_elements')->where('whiteboard_id', $board->id)->count())->toBe(2)
        ->and(DB::table('whiteboard_elements')->where('whiteboard_id', $board->id)->where('element_id', 'abc123')->count())->toBe(1);
});
