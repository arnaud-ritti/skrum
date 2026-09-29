<?php

it('accepts client events only from channel members', function () {
    expect(config('reverb.apps.apps.0.accept_client_events_from'))->toBe('members');
});
