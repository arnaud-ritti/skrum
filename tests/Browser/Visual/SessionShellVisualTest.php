<?php

it('renders the session shell at its worst case without overflow', function () {
    $this->captureVisuals(
        'session-shell',
        '/dev/design-system/session-shell',
        fn (string $path, array $options) => visit($path, $options)
            ->resize(1440, 900)
            ->assertPresent('[data-bench-section="session-shell"]')
            ->assertCount('[data-realtime]', 3)
            ->assertScript('[...document.querySelectorAll(\'[data-slot="session-frame"] header\')].map((header) => header.getBoundingClientRect().height / parseFloat(getComputedStyle(document.documentElement).fontSize)).join()', '3.5,3.5,3.5')
            ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0),
    );
});
