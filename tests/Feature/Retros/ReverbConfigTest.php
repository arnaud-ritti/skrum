<?php

it('accepts client events only from channel members', function () {
    expect(config('reverb.apps.apps.0.accept_client_events_from'))->toBe('members');
});

it('gives the Reverb server and the broadcaster the same credentials', function () {
    foreach (['key', 'secret', 'app_id'] as $field) {
        expect(config("reverb.apps.apps.0.{$field}"))
            ->toBeString()
            ->not->toBeEmpty()
            ->toBe(config("broadcasting.connections.reverb.{$field}"));
    }

    expect(config('reverb.apps.apps.0.key'))->not->toBe(config('reverb.apps.apps.0.secret'));
});
