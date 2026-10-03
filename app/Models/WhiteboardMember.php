<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\WhiteboardMemberFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $whiteboard_id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property int|null $presence_color
 * @property Carbon|null $created_at
 * @property-read Whiteboard $whiteboard
 * @property-read User|null $user
 */
#[Fillable(['whiteboard_id', 'user_id', 'guest_name', 'guest_secret_hash', 'presence_color'])]
#[Hidden(['guest_secret_hash'])]
class WhiteboardMember extends Model
{
    /** @use HasFactory<WhiteboardMemberFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;

    public static function current(Request $request): self
    {
        $member = $request->attributes->get('whiteboardMember');

        abort_unless($member instanceof self, 403);

        return $member;
    }

    /** @return BelongsTo<Whiteboard, $this> */
    public function whiteboard(): BelongsTo
    {
        return $this->belongsTo(Whiteboard::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'presence_color' => 'integer',
        ];
    }
}
