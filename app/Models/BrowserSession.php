<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A row of the framework's `sessions` table, read for the security section.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string $payload
 * @property int $last_activity
 */
class BrowserSession extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $table = 'sessions';

    protected $keyType = 'string';
}
