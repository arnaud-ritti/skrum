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

it('drops an image appended after the end of a JPEG', function () {
    $clean = ImageMetadata::strip(jpegBytes(withExif: false).jpegBytes(), 'image/jpeg');

    expect($clean)->toBe(jpegBytes(withExif: false))
        ->and($clean)->not->toContain('Exif');
});

it('drops the multi-picture index but keeps the colour profile of a JPEG', function () {
    $iccProfile = jpegSegment(0xE2, "ICC_PROFILE\0\x01\x01profile");
    $multiPicture = jpegSegment(0xE2, "MPF\0II*\0index");
    $bytes = jpegBytes(withExif: false);
    $withSegments = "\xFF\xD8".$iccProfile.$multiPicture.substr($bytes, 2);

    $clean = ImageMetadata::strip($withSegments, 'image/jpeg');

    expect($clean)->toBe("\xFF\xD8".$iccProfile.substr($bytes, 2));
});

it('drops metadata between the scans of a progressive JPEG and keeps the scan data', function () {
    $bytes = jpegBytes(withExif: false);
    $endOfImage = strlen($bytes) - 2;
    $secondScan = jpegSegment(0xDA, "\x01\x01\0\0\x3F\0")."\x56\xFF\x00\xFF\xD0\x78";
    $comment = jpegSegment(0xFE, 'taken at home');
    $paddedTable = "\xFF".jpegSegment(0xC4, "\0\x01");

    $clean = ImageMetadata::strip(substr($bytes, 0, $endOfImage).$comment.$paddedTable.$secondScan."\xFF\xD9", 'image/jpeg');

    expect($clean)->toBe(substr($bytes, 0, $endOfImage).jpegSegment(0xC4, "\0\x01").$secondScan."\xFF\xD9");
});

it('reads a JPEG whose markers are preceded by fill bytes', function () {
    $bytes = jpegBytes(withExif: false);

    $clean = ImageMetadata::strip("\xFF\xD8\xFF\xFF".substr($bytes, 2), 'image/jpeg');

    expect($clean)->toBe($bytes);
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
