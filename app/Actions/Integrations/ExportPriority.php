<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;

/**
 * A Jira priority id or a Linear value; null leaves the provider default.
 */
class ExportPriority
{
    public function __construct(
        public string|int|null $value,
        public ?ExportWarningCode $warning = null,
        public ?string $name = null,
    ) {}
}
