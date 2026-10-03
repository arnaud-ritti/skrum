<?php

use App\Support\Avatars\ImageMetadata;

it('removes Exif, IPTC and comments from a JPEG and keeps the image', function () {
    $clean = ImageMetadata::strip(jpegBytes(), 'image/jpeg');

    expect($clean)->not->toBeNull()
        ->and($clean)->not->toContain('Exif')
        ->and($clean)->not->toContain('GPS')
        ->and($clean)->not->toContain('Photoshop')
        ->and($clean)->not->toContain('taken at home')
        ->and($clean)->toContain('JFIF')
        ->and($clean)->toBe(jpegBytes(withExif: false))
        ->and(getimagesizefromstring($clean))->not->toBeFalse();
});

it('removes text chunks from a PNG and keeps the image', function () {
    $clean = ImageMetadata::strip(pngBytes(['Comment' => 'home', 'Author' => 'Ada']), 'image/png');

    expect($clean)->toBe(pngBytes())
        ->and(getimagesizefromstring($clean)[0])->toBe(1);
});

it('refuses bytes that are not what they claim', function (string $bytes, string $mime) {
    expect(ImageMetadata::strip($bytes, $mime))->toBeNull();
})->with([
    'png as jpeg' => [fn () => pngBytes(), 'image/jpeg'],
    'truncated jpeg' => [fn () => substr(jpegBytes(), 0, 30), 'image/jpeg'],
    'truncated png' => [fn () => substr(pngBytes(), 0, 40), 'image/png'],
    'gif' => ['GIF89a', 'image/gif'],
]);
