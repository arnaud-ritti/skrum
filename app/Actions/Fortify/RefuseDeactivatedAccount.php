<?php

namespace App\Actions\Fortify;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;

class RefuseDeactivatedAccount
{
    /**
     * Speaks only to whoever holds the password: anyone else gets the usual failure further down the pipeline.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $password = (string) $request->input('password');

        $holdsDeactivatedAccount = User::query()
            ->whereAddress((string) $request->input(Fortify::username()))
            ->whereNotNull('deactivated_at')
            ->orderBy('id')
            ->get()
            ->contains(fn (User $user): bool => Hash::check($password, $user->password));

        if ($holdsDeactivatedAccount) {
            throw ValidationException::withMessages([
                Fortify::username() => __('This account is deactivated. Ask an admin of the instance.'),
            ]);
        }

        return $next($request);
    }
}
