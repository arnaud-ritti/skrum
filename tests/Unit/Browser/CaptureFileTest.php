<?php

use Tests\Browser\Support\CaptureFile;

/**
 * @param  array<int, array{int, int, int}>  $dots  x, y and the red value of single pixels drawn over the picture
 */
function capturePng(string $path, int $compression = 9, int $width = 400, array $dots = []): void
{
    $image = imagecreatetruecolor($width, 300);
    imagefill($image, 0, 0, imagecolorallocate($image, 30, 120, 200));
    imagefilledrectangle($image, 50, 50, 200, 200, imagecolorallocate($image, 250, 250, 250));

    foreach ($dots as [$x, $y, $red]) {
        imagesetpixel($image, $x, $y, imagecolorallocate($image, $red, 120, 200));
    }

    imagepng($image, $path, $compression);
}

beforeEach(function () {
    $this->directory = sys_get_temp_dir().'/capture-file-'.bin2hex(random_bytes(6));
    mkdir($this->directory);
    $this->tracked = "{$this->directory}/tracked.png";
    $this->candidate = "{$this->directory}/candidate.png";
});

afterEach(function () {
    array_map(unlink(...), glob("{$this->directory}/*"));
    rmdir($this->directory);
});

it('keeps the tracked file when the new capture has the same pixels in other bytes', function () {
    capturePng($this->tracked, compression: 9);
    capturePng($this->candidate, compression: 0);
    $trackedBytes = file_get_contents($this->tracked);

    expect(file_get_contents($this->candidate))->not->toBe($trackedBytes)
        ->and(CaptureFile::replaceWhenPictureDiffers($this->candidate, $this->tracked))->toBeFalse()
        ->and(file_get_contents($this->tracked))->toBe($trackedBytes)
        ->and(file_exists($this->candidate))->toBeFalse();
});

it('keeps the tracked file when a few pixels moved by a faint shade', function () {
    capturePng($this->tracked);
    capturePng($this->candidate, dots: array_map(fn (int $x): array => [$x, 10, 80], range(1, 10)));
    $trackedBytes = file_get_contents($this->tracked);

    expect(CaptureFile::replaceWhenPictureDiffers($this->candidate, $this->tracked))->toBeFalse()
        ->and(file_get_contents($this->tracked))->toBe($trackedBytes);
});

it('replaces the tracked file when a single pixel changed colour outright', function () {
    capturePng($this->tracked);
    capturePng($this->candidate, dots: [[10, 10, 230]]);
    $candidateBytes = file_get_contents($this->candidate);

    expect(CaptureFile::replaceWhenPictureDiffers($this->candidate, $this->tracked))->toBeTrue()
        ->and(file_get_contents($this->tracked))->toBe($candidateBytes)
        ->and(file_exists($this->candidate))->toBeFalse();
});

it('replaces the tracked file when many pixels moved by a faint shade', function () {
    capturePng($this->tracked);
    capturePng($this->candidate, dots: array_map(fn (int $x): array => [$x, 10, 80], range(1, 100)));

    expect(CaptureFile::replaceWhenPictureDiffers($this->candidate, $this->tracked))->toBeTrue();
});

it('replaces the tracked file when the size differs', function () {
    capturePng($this->tracked);
    capturePng($this->candidate, width: 401);

    expect(CaptureFile::replaceWhenPictureDiffers($this->candidate, $this->tracked))->toBeTrue()
        ->and(getimagesize($this->tracked)[0])->toBe(401);
});

it('stores the first capture of a page', function () {
    capturePng($this->candidate);

    expect(CaptureFile::replaceWhenPictureDiffers($this->candidate, $this->tracked))->toBeTrue()
        ->and(file_exists($this->tracked))->toBeTrue();
});
