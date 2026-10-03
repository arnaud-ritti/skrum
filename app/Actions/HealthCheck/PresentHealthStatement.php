<?php

namespace App\Actions\HealthCheck;

use App\Enums\HealthStatement;
use App\Models\TeamHealthStatement;

class PresentHealthStatement
{
    /**
     * @return array{
     *     key: string,
     *     label: string,
     *     text: string,
     *     isBuiltin: bool
     * }
     */
    public function handle(TeamHealthStatement|HealthStatement $statement): array
    {
        if ($statement instanceof HealthStatement) {
            return [
                'key' => $statement->value,
                'label' => $statement->label(),
                'text' => $statement->text(),
                'isBuiltin' => true,
            ];
        }

        if ($statement->builtin !== null) {
            return $this->handle($statement->builtin);
        }

        return [
            'key' => $statement->key(),
            'label' => (string) $statement->label,
            'text' => (string) $statement->text,
            'isBuiltin' => false,
        ];
    }
}
