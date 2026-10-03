<?php

namespace App\Support\Avatars;

/**
 * Removes what a photo says about where and when it was taken, without an
 * image library: JPEG segments and PNG chunks are copied or skipped, the
 * pixels are never decoded. A file that does not parse is refused.
 */
class ImageMetadata
{
    /** @var array<int, int> JFIF, ICC profile, Adobe colour transform: needed to draw the image. */
    private const array KeptJpegApplicationSegments = [0xE0, 0xE2, 0xEE];

    private const int JpegComment = 0xFE;

    private const int JpegStartOfScan = 0xDA;

    /** @var array<int, string> */
    private const array DroppedPngChunks = ['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'];

    private const string PngSignature = "\x89PNG\r\n\x1A\n";

    public static function strip(string $bytes, string $mime): ?string
    {
        return match ($mime) {
            'image/jpeg' => self::stripJpeg($bytes),
            'image/png' => self::stripPng($bytes),
            default => null,
        };
    }

    private static function stripJpeg(string $bytes): ?string
    {
        if (! str_starts_with($bytes, "\xFF\xD8")) {
            return null;
        }

        $clean = "\xFF\xD8";
        $offset = 2;
        $length = strlen($bytes);

        while ($offset + 4 <= $length) {
            if ($bytes[$offset] !== "\xFF") {
                return null;
            }

            $marker = ord($bytes[$offset + 1]);

            if ($marker === self::JpegStartOfScan) {
                return $clean.substr($bytes, $offset);
            }

            $segmentLength = self::unsignedInteger('n', substr($bytes, $offset + 2, 2));
            $end = $offset + 2 + $segmentLength;

            if ($segmentLength < 2 || $end > $length) {
                return null;
            }

            if (! self::isDroppedJpegSegment($marker)) {
                $clean .= substr($bytes, $offset, $end - $offset);
            }

            $offset = $end;
        }

        return null;
    }

    private static function isDroppedJpegSegment(int $marker): bool
    {
        if ($marker === self::JpegComment) {
            return true;
        }

        if ($marker < 0xE0 || $marker > 0xEF) {
            return false;
        }

        return ! in_array($marker, self::KeptJpegApplicationSegments, true);
    }

    private static function stripPng(string $bytes): ?string
    {
        if (! str_starts_with($bytes, self::PngSignature)) {
            return null;
        }

        $clean = self::PngSignature;
        $offset = strlen(self::PngSignature);
        $length = strlen($bytes);

        while ($offset + 12 <= $length) {
            $chunkLength = self::unsignedInteger('N', substr($bytes, $offset, 4));
            $type = substr($bytes, $offset + 4, 4);
            $end = $offset + 12 + $chunkLength;

            if ($end > $length) {
                return null;
            }

            if (! in_array($type, self::DroppedPngChunks, true)) {
                $clean .= substr($bytes, $offset, 12 + $chunkLength);
            }

            if ($type === 'IEND') {
                return $clean;
            }

            $offset = $end;
        }

        return null;
    }

    private static function unsignedInteger(string $format, string $bytes): int
    {
        $values = unpack($format, $bytes);

        return is_array($values) && is_int($values[1] ?? null) ? $values[1] : 0;
    }
}
