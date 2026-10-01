<?php

namespace Tests\Browser\Support;

use GdImage;
use RuntimeException;

class CaptureFile
{
    private const int NoiseChannelDelta = 64;

    private const int NoisePixelsPerMillion = 200;

    /**
     * Two captures of an unchanged page are neither byte-identical (PNG
     * encoding) nor always pixel-identical: Chromium anti-aliases the edge of
     * a rounded shape in one of two ways from one run to the next (measured:
     * 6 to 15 pixels of a 1440x900 capture, channel delta up to 55). A fresh
     * capture therefore replaces the tracked file only when the picture
     * changed by more than that noise.
     */
    public static function replaceWhenPictureDiffers(string $candidate, string $tracked): bool
    {
        if (is_file($tracked) && self::samePicture($candidate, $tracked)) {
            unlink($candidate);

            return false;
        }

        rename($candidate, $tracked);

        return true;
    }

    public static function samePicture(string $first, string $second): bool
    {
        if (hash_file('xxh128', $first) === hash_file('xxh128', $second)) {
            return true;
        }

        $firstImage = self::decode($first);
        $secondImage = self::decode($second);

        if (imagesx($firstImage) !== imagesx($secondImage)) {
            return false;
        }

        if (imagesy($firstImage) !== imagesy($secondImage)) {
            return false;
        }

        if (self::pixels($firstImage) === self::pixels($secondImage)) {
            return true;
        }

        return self::differsOnlyByRasterNoise($firstImage, $secondImage);
    }

    private static function differsOnlyByRasterNoise(GdImage $first, GdImage $second): bool
    {
        $width = imagesx($first);
        $height = imagesy($first);
        $allowedPixels = intdiv($width * $height * self::NoisePixelsPerMillion, 1_000_000);
        $differingPixels = 0;

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $one = imagecolorat($first, $x, $y);
                $other = imagecolorat($second, $x, $y);

                if ($one === $other) {
                    continue;
                }

                if (++$differingPixels > $allowedPixels) {
                    return false;
                }

                foreach ([24, 16, 8, 0] as $shift) {
                    if (abs((($one >> $shift) & 0xFF) - (($other >> $shift) & 0xFF)) > self::NoiseChannelDelta) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private static function decode(string $path): GdImage
    {
        $image = @imagecreatefrompng($path);

        throw_if($image === false, RuntimeException::class, "Not a readable PNG: {$path}");

        imagepalettetotruecolor($image);

        return $image;
    }

    private static function pixels(GdImage $image): string
    {
        imagesavealpha($image, true);

        ob_start();
        imagepng($image, null, 0, PNG_NO_FILTER);

        return (string) ob_get_clean();
    }
}
