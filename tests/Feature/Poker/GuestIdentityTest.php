<?php

use App\Actions\Retros\GuestCookie;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Str;

function guestIdentitySeed(string $identity): string
{
    return substr(hash_hmac('sha256', $identity, (string) config('app.key')), 0, 32);
}

it('keeps the retro avatar seed and cookie name', function () {
    $retro = Retro::factory()->create();
    [$user, $member] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Visitor']);
    $formerMember = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => null]);

    expect($member->avatarSeed())->toBe(guestIdentitySeed($user->id))
        ->and($member->avatarUrl())->toBe(route('avatars.show', guestIdentitySeed($user->id), absolute: false))
        ->and($member->isGuest())->toBeFalse()
        ->and($member->displayName())->toBe($user->name)
        ->and($guest->avatarSeed())->toBe(guestIdentitySeed($guest->id))
        ->and($guest->isGuest())->toBeTrue()
        ->and($guest->displayName())->toBe('Visitor')
        ->and($formerMember->displayName())->toBe('Former member')
        ->and(GuestCookie::name(GuestCookie::RetroScope, $retro->id))->toBe("retro_guest_{$retro->id}");
});

it('names poker guest cookies separately', function () {
    $gameId = (string) Str::uuid();
    $playerId = (string) Str::uuid();

    $cookie = GuestCookie::make(GuestCookie::PokerScope, $gameId, $playerId, 'secret');

    expect(GuestCookie::name(GuestCookie::PokerScope, $gameId))->toBe("poker_guest_{$gameId}")
        ->and(GuestCookie::name(GuestCookie::PokerScope, $gameId))->not->toBe(GuestCookie::name(GuestCookie::RetroScope, $gameId))
        ->and($cookie->getName())->toBe("poker_guest_{$gameId}")
        ->and($cookie->getValue())->toBe("{$playerId}|secret")
        ->and(GuestCookie::parse($cookie->getValue()))->toBe([$playerId, 'secret']);
});
