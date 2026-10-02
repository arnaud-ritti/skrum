<?php

namespace App\Exceptions;

use DomainException;
use Illuminate\Database\Eloquent\Model;

/**
 * A row would break a rule of its model. Raised by the model on every engine: the Schema builder
 * has no check constraint, so no database constraint stands behind these rules on a fresh install.
 */
class ModelInvariantViolation extends DomainException
{
    public static function because(Model $model, string $rule): self
    {
        $name = class_basename($model);

        return new self("{$name}: {$rule}");
    }
}
