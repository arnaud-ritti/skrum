<?php

it('shows in the README only images that exist in the repository', function () {
    preg_match_all('/(?:src|srcset)="([^"]+)"/', (string) file_get_contents(base_path('README.md')), $matches);

    $local = collect($matches[1])->reject(fn (string $path): bool => str_starts_with($path, 'http'));

    expect($local)->not->toBeEmpty();

    $local->each(fn (string $path) => expect(base_path($path))->toBeFile());
});
