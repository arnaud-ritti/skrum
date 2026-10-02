<?php

it('[P18e-07-02] renders the guest-join page of a whiteboard without overflow', function () {
    ['board' => $board] = whiteboardWithFacilitator(['title' => 'Sprint 42 planning board']);
    whiteboardGuest($board);
    whiteboardGuest($board, 'other-secret');

    $this->captureVisuals(
        'whiteboard-join',
        $this->whiteboardJoinPath($board),
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="guest-join-session"][data-kind="whiteboard"]')
            ->assertPresent('#name'),
    );
});

it('[P18e-07-03] renders the notice of an invalid whiteboard guest link without overflow', function () {
    $this->captureVisuals(
        'whiteboard-join-invalid',
        '/whiteboards/join/no-such-link',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="access-notice"]')
            ->assertNotPresent('#name'),
    );
});
