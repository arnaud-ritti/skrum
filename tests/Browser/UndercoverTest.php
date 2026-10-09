<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Models\GameRoom;
use App\Models\Retro;

it('plays a complete Undercover round across three live clients', function (bool $icebreaker) {
    if ($icebreaker) {
        $retro = Retro::factory()->withIcebreaker()->withGuestAccess()->inPhase(RetroPhase::Icebreaker)->create(['icebreaker_game' => GameKind::Undercover]);
        [$host] = retroFacilitator($retro);
        $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());
        $path = route('retros.show', $retro, false);
        $join = route('retros.join.show', $retro->guest_token, false);
    } else {
        $room = GameRoom::factory()->game(GameKind::Undercover)->linkAccess()->create();
        [$host] = gameRoomHost($room);
        $path = route('games.show', $room, false);
        $join = route('games.join.show', $room->guest_token, false);
    }
    renamedUser($host, 'Ada');
    $a = $this->awaitRealtime($this->signIn($host, $path, ['colorScheme' => $icebreaker ? 'dark' : 'light']));
    $b = $this->awaitRealtime($this->joinAsGuest($join, 'Bob'));
    $c = $this->awaitRealtime($this->joinAsGuest($join, 'Casey'));
    if ($icebreaker) {
        $a->resize(390, 844);
    }
    $start = '[data-slot="round-start-card"] button:has-text("Start")';
    $a->assertEnabled($start)->click($start);
    foreach ([$a, $b, $c] as $page) {
        $page->assertVisible('[data-slot="undercover-board"]')->assertSee('Your secret word')->assertSee('Show word');
    }
    $a->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)->screenshot(fullPage: true, filename: $icebreaker ? 'undercover-icebreaker-mobile' : 'undercover-room-desktop');
    $round = $room->fresh()->activeRound();
    $pages = ['Ada' => $a, 'Bob' => $b, 'Casey' => $c];
    foreach ($room->players()->get() as $player) {
        $page = $pages[$player->displayName()];
        $word = $round->undercover_state['words'][$round->undercover_state['roles'][$player->id]];
        $page->assertDontSeeIn('[data-slot="undercover-secret"]', $word)->click('Show word')->assertSeeIn('[data-slot="undercover-secret"]', $word)->click('Hide word')->assertDontSeeIn('[data-slot="undercover-secret"]', $word);
    }
    foreach ($round->turnOrder() as $id) {
        $speaker = $room->players()->findOrFail($id);
        $a->assertSee($speaker->displayName().' is speaking')->wait(1)->click('[data-slot="undercover-board"] button:has-text("Next")');
    }
    $a->assertSee('Discuss together')->click('Open voting');
    foreach ([$a, $b, $c] as $page) {
        $page->assertSee('Vote to eliminate a player');
    }
    $targetId = array_search('undercover', $round->undercover_state['roles'], true);
    $target = $room->players()->findOrFail($targetId);
    $voter = $room->players()->where('id', '!=', $targetId)->where('id', '!=', $room->players()->get()->first(fn ($player) => $player->displayName() === 'Ada')->id)->firstOrFail();
    $pages[$voter->displayName()]->click('[data-slot="undercover-board"] li:has-text("'.$target->displayName().'") button');
    $a->assertSee('1 vote received')->click('Close voting');
    foreach ([$a, $b, $c] as $page) {
        $page->assertSee('The civilians win!')->assertSee($round->undercover_state['words']['civilian'])->assertSee($round->undercover_state['words']['undercover'])->assertNoJavascriptErrors();
    }
})->with(['salon' => false, 'icebreaker' => true]);
