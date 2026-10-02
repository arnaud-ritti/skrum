<?php

it('[P18e-01-08] renders the new session dialog and its retro form without overflow', function () {
    $this->captureVisuals(
        'session-create',
        '/dev/design-system/session-create',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="session-create"]')
            ->assertPresent('[data-slot="session-create-whole"] [data-slot="retro-column-draft"]')
            ->assertPresent('[role="dialog"] [data-slot="retro-column-draft"]')
            ->assertCount('[role="dialog"] button[type="submit"]', 1),
    );
});

it('[P18e-01-08b] renders the poker form of the new session dialog without overflow', function () {
    $this->captureVisuals(
        'session-create-poker',
        '/dev/design-system/session-create-poker',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-bench-section="session-create-poker"]')
            ->assertPresent('[data-slot="session-create-whole"] [data-slot="deck-picker"]')
            ->assertPresent('[role="dialog"] [data-slot="deck-picker"]')
            ->assertCount('[role="dialog"] button[type="submit"]', 1),
    );
});
