<?php

namespace App\Exceptions;

use InvalidArgumentException;

class InvalidBrandAsset extends InvalidArgumentException
{
    public static function tooLarge(): self
    {
        return new self(__('The image must not be larger than 512 KB.'));
    }

    public static function unsupportedType(): self
    {
        return new self(__('The image must be a PNG, JPEG, WebP or SVG file.'));
    }

    public static function notDrawnByMailClients(): self
    {
        return new self(__('The logo for e-mails must be a PNG or JPEG image at least 128 px wide.'));
    }
}
