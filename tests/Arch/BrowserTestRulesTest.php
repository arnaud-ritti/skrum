<?php

/**
 * @return array<int, string>
 */
function forbiddenBrowserTestCalls(string $directory): array
{
    if (! is_dir($directory)) {
        return [];
    }

    $forbiddenCalls = ['actingAs(', 'withCookie(', 'withCookies(', 'Event::fake()'];
    $offences = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        if ($file->getExtension() !== 'php') {
            continue;
        }

        foreach (file($file->getPathname()) ?: [] as $index => $line) {
            foreach ($forbiddenCalls as $forbiddenCall) {
                if (str_contains($line, $forbiddenCall)) {
                    $lineNumber = $index + 1;
                    $offences[] = "{$file->getPathname()}:{$lineNumber} calls {$forbiddenCall}";
                }
            }
        }
    }

    sort($offences);

    return $offences;
}

it('keeps browser tests free of actingAs, injected cookies and a blanket event fake', function () {
    expect(forbiddenBrowserTestCalls(__DIR__.'/../Browser'))->toBeEmpty();
});
