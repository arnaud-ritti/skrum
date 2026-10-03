<?php

namespace App\Support\Avatars;

/**
 * Removes what a photo says about where and when it was taken, without an
 * image library: JPEG segments and PNG chunks are copied or skipped, the
 * pixels are never decoded. A file that does not parse is refused.
 */
class ImageMetadata
{
    /** @var array<int, int> JFIF and Adobe colour transform: needed to draw the image. */
    private const array KeptJpegApplicationSegments = [0xE0, 0xEE];

    /** APP2 also carries the multi-picture index of phone photos; only its ICC profile is kept. */
    private const int JpegColourProfile = 0xE2;

    private const int JpegTemporary = 0x01;

    private const int JpegEndOfImage = 0xD9;

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

        while ($offset + 2 <= $length) {
            if ($bytes[$offset] !== "\xFF") {
                return null;
            }

            $offset = self::skipJpegFillBytes($bytes, $offset);

            if ($offset + 2 > $length) {
                return null;
            }

            $marker = ord($bytes[$offset + 1]);

            if ($marker === self::JpegEndOfImage) {
                return "{$clean}\xFF\xD9";
            }

            if (self::isStandaloneJpegMarker($marker)) {
                $clean .= substr($bytes, $offset, 2);
                $offset += 2;

                continue;
            }

            if ($offset + 4 > $length) {
                return null;
            }

            $segmentLength = self::unsignedInteger('n', substr($bytes, $offset + 2, 2));
            $end = $offset + 2 + $segmentLength;

            if ($segmentLength < 2 || $end > $length) {
                return null;
            }

            $segment = substr($bytes, $offset, $end - $offset);

            if (! self::isDroppedJpegSegment($marker, $segment)) {
                $clean .= $segment;
            }

            $offset = $end;

            if ($marker === self::JpegStartOfScan) {
                $nextMarker = self::nextJpegMarker($bytes, $offset);

                if ($nextMarker === null) {
                    return null;
                }

                $clean .= substr($bytes, $offset, $nextMarker - $offset);
                $offset = $nextMarker;
            }
        }

        return null;
    }

    private static function skipJpegFillBytes(string $bytes, int $offset): int
    {
        $length = strlen($bytes);

        while ($offset + 1 < $length && $bytes[$offset + 1] === "\xFF") {
            $offset++;
        }

        return $offset;
    }

    /**
     * Entropy-coded data runs until the first 0xFF that is neither a stuffed
     * zero nor a restart marker; whatever follows the image is never copied.
     */
    private static function nextJpegMarker(string $bytes, int $offset): ?int
    {
        $length = strlen($bytes);

        while (($position = strpos($bytes, "\xFF", $offset)) !== false) {
            if ($position + 1 >= $length) {
                return null;
            }

            $following = ord($bytes[$position + 1]);

            if ($following === 0x00) {
                $offset = $position + 2;

                continue;
            }

            if (self::isRestartMarker($following)) {
                $offset = $position + 2;

                continue;
            }

            return $position;
        }

        return null;
    }

    private static function isStandaloneJpegMarker(int $marker): bool
    {
        return $marker === self::JpegTemporary || self::isRestartMarker($marker);
    }

    private static function isRestartMarker(int $marker): bool
    {
        return $marker >= 0xD0 && $marker <= 0xD7;
    }

    private static function isDroppedJpegSegment(int $marker, string $segment): bool
    {
        if ($marker === self::JpegComment) {
            return true;
        }

        if ($marker < 0xE0 || $marker > 0xEF) {
            return false;
        }

        if ($marker === self::JpegColourProfile) {
            return ! str_starts_with(substr($segment, 4), "ICC_PROFILE\0");
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
