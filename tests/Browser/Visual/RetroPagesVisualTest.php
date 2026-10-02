<?php

use App\Models\Retro;

function p18eRetroVisualRetro(): Retro
{
    $retro = Retro::factory()->withGuestAccess()->create([
        'title' => 'Sprint 42 retro · Atlas team',
        'guest_token' => 'visual-guest-token-of-the-retro-pages-01',
    ]);

    [$facilitator] = retroFacilitator($retro);
    retroMember($retro);
    retroMember($retro);

    $facilitator->update(['name' => 'Fran Facilitator']);

    return $retro->fresh();
}

it('[P18e-R2-01] renders the guest join, the invalid guest link and the ended session without overflow', function (string $name, string $path, string $marker) {
    $retro = p18eRetroVisualRetro();

    $this->captureVisuals(
        $name,
        str_replace('{retro}', $retro->id, $path),
        fn (string $path, array $options) => visit($path, $options)->assertPresent($marker),
    );
})->with([
    'guest join' => ['retro-join', '/join/visual-guest-token-of-the-retro-pages-01', '[data-slot="guest-join"] #name'],
    'invalid guest link' => ['retro-join-invalid', '/join/a-guest-token-that-does-not-exist', '[data-slot="access-notice"]'],
    'session ended' => ['retro-session-ended', '/retros/{retro}', '[data-slot="access-notice"] a'],
]);
