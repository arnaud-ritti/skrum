<?php

namespace App\Exceptions;

use Exception;

class InvalidAvatarPhoto extends Exception
{
    public static function unreadable(): self
    {
        return new self(__('This image could not be read. Choose a JPEG or PNG file.'));
    }
}
