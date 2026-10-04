<?php

namespace App\Support\Settings;

use App\Models\BrowserSession;
use App\Models\User;
use App\Support\Auth\UserAgentSummary;
use Illuminate\Auth\SessionGuard;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The devices signed in to an account, with the browser and the IP address
 * the framework stored (the owner's choice: no location). A session id is a
 * secret: only its hash leaves the server. Signing a device out also changes
 * the remember token, so that its "Remember me" cookie cannot sign it back in.
 */
class BrowserSessions
{
    /** Laravel's own "Remember me" lifetime (SessionGuard). */
    private const int RememberMinutes = 576000;

    public const int Shown = 50;

    public function available(): bool
    {
        return config('session.driver') === 'database';
    }

    /**
     * @return array<int, array{
     *     key: string,
     *     device: string,
     *     deviceKind: string,
     *     ipAddress: ?string,
     *     isCurrent: bool,
     *     lastActiveAt: string
     * }>
     */
    public function of(User $user, string $currentId): array
    {
        if (! $this->available()) {
            return [];
        }

        return BrowserSession::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_activity')
            ->orderBy('id')
            ->limit(self::Shown)
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn (BrowserSession $session): array => [
                'key' => hash('sha256', $session->id),
                'device' => UserAgentSummary::describe($session->user_agent) ?? __('Unknown device'),
                'deviceKind' => UserAgentSummary::deviceKind($session->user_agent),
                'ipAddress' => $session->ip_address,
                'isCurrent' => hash_equals($currentId, $session->id),
                'lastActiveAt' => Date::createFromTimestamp($session->last_activity)->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    public function signOut(User $user, string $key, string $currentId): bool
    {
        if (! $this->available()) {
            return false;
        }

        return DB::transaction(function () use ($user, $key, $currentId): bool {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $target = BrowserSession::query()
                ->where('user_id', $locked->id)
                ->get(['id'])
                ->first(fn (BrowserSession $session): bool => hash_equals(hash('sha256', $session->id), $key));

            if ($target === null) {
                return false;
            }

            if (hash_equals($currentId, $target->id)) {
                return false;
            }

            BrowserSession::query()->whereKey($target->id)->delete();

            $this->forgetRememberedDevices($locked);

            return true;
        });
    }

    public function signOutOthers(User $user, string $currentId): int
    {
        if (! $this->available()) {
            return 0;
        }

        return DB::transaction(function () use ($user, $currentId): int {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $count = BrowserSession::query()->where('user_id', $locked->id)->whereKeyNot($currentId)->delete();

            $this->forgetRememberedDevices($locked);

            return $count;
        });
    }

    /**
     * The device asking keeps its "Remember me": its cookie is written again with the new token,
     * as Laravel's logoutOtherDevices does.
     */
    private function forgetRememberedDevices(User $user): void
    {
        $user->setRememberToken(Str::random(60));
        $user->save();

        $guard = Auth::guard();

        if (! $guard instanceof SessionGuard || ! request()->cookies->has($guard->getRecallerName())) {
            return;
        }

        Cookie::queue(
            $guard->getRecallerName(),
            $user->getAuthIdentifier().'|'.$user->getRememberToken().'|'.$guard->hashPasswordForCookie($user->getAuthPassword()),
            self::RememberMinutes,
        );
    }
}
