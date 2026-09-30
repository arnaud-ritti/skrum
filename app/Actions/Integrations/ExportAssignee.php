<?php

namespace App\Actions\Integrations;

use App\Enums\ExportWarningCode;

class ExportAssignee
{
    public function __construct(
        public ?string $accountId,
        public ?ExportWarningCode $warning = null,
        public ?string $name = null,
    ) {}

    public static function assigned(string $accountId, string $name): self
    {
        return new self($accountId, null, $name);
    }

    public static function unassigned(?ExportWarningCode $warning = null, ?string $name = null): self
    {
        return new self(null, $warning, $name);
    }

    public function withoutAccount(ExportWarningCode $warning): self
    {
        return new self(null, $warning, $this->name);
    }
}
