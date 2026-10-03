<?php

namespace App\Support\Settings;

use App\Enums\SsoProvider;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInMethods;

/**
 * The Linked accounts card: every enabled provider, and a provider turned
 * off only while the user still holds an identity of it.
 */
class LinkedAccounts
{
    public function __construct(private SignInMethods $methods) {}

    /**
     * `lastWayIn` is true when an identity the user could otherwise remove
     * is kept because it is their last way in.
     *
     * @return array{
     *     rows: array<int, array{
     *         provider: string,
     *         label: string,
     *         isEnabled: bool,
     *         account: ?array{
     *             id: string,
     *             linkedAt: ?string,
     *             isManaged: bool,
     *             canUnlink: bool
     *         }
     *     }>,
     *     lastWayIn: bool
     * }
     */
    public function of(User $user): array
    {
        $accounts = $user->socialAccounts()
            ->oldest()
            ->orderBy('id')
            ->get()
            ->unique('provider')
            ->keyBy('provider');

        $rows = [];

        foreach (SsoProvider::cases() as $provider) {
            /** @var ?SocialAccount $account */
            $account = $accounts->get($provider->value);
            $isEnabled = $provider->isEnabled();

            if (! $isEnabled && $account === null) {
                continue;
            }

            $rows[] = [
                'provider' => $provider->value,
                'label' => $provider->label(),
                'isEnabled' => $isEnabled,
                'account' => $account === null ? null : $this->describe($user, $account),
            ];
        }

        $isLastWayIn = collect($rows)
            ->pluck('account')
            ->filter()
            ->contains(fn (array $account): bool => ! $account['isManaged'] && ! $account['canUnlink']);

        return [
            'rows' => $rows,
            'lastWayIn' => $isLastWayIn,
        ];
    }

    /**
     * @return array{
     *     id: string,
     *     linkedAt: ?string,
     *     isManaged: bool,
     *     canUnlink: bool
     * }
     */
    private function describe(User $user, SocialAccount $account): array
    {
        $isManaged = $this->methods->isManagedByAdmin($account);

        return [
            'id' => $account->id,
            'linkedAt' => $account->created_at?->toIso8601String(),
            'isManaged' => $isManaged,
            'canUnlink' => ! $isManaged && $this->methods->remaining($user, $account) !== [],
        ];
    }
}
