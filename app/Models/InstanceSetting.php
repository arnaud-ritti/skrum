<?php

namespace App\Models;

use Database\Factories\InstanceSettingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $key
 * @property mixed $value
 */
#[Fillable(['key', 'value'])]
class InstanceSetting extends Model
{
    /** @use HasFactory<InstanceSettingFactory> */
    use HasFactory;

    use HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'value' => 'json',
        ];
    }
}
