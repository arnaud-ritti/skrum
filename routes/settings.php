<?php

use App\Http\Controllers\Settings\ApiTokensController;
use App\Http\Controllers\Settings\EmailSecondFactorCodesController;
use App\Http\Controllers\Settings\EmailSecondFactorsController;
use App\Http\Controllers\Settings\NotificationPreferencesController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Middleware\EnsureMcpIsEnabled;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function (): void {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
});

Route::middleware(['auth', 'verified'])->group(function (): void {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])
        ->middleware(RequirePassword::class)
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::middleware([RequirePassword::class, 'throttle:6,1,emailSecondFactor'])->group(function (): void {
        Route::post('settings/email-second-factor/code', [EmailSecondFactorCodesController::class, 'store'])->name('emailSecondFactor.codes.store');
        Route::post('settings/email-second-factor', [EmailSecondFactorsController::class, 'store'])->name('emailSecondFactor.store');
        Route::delete('settings/email-second-factor', [EmailSecondFactorsController::class, 'destroy'])->name('emailSecondFactor.destroy');
    });

    Route::get('settings/notifications', [NotificationPreferencesController::class, 'edit'])->name('notificationPreferences.edit');
    Route::patch('settings/notifications', [NotificationPreferencesController::class, 'update'])->name('notificationPreferences.update');

    Route::middleware(EnsureMcpIsEnabled::class)->group(function (): void {
        Route::get('settings/api-tokens', [ApiTokensController::class, 'index'])
            ->middleware(RequirePassword::class)
            ->name('apiTokens.index');

        Route::post('settings/api-tokens', [ApiTokensController::class, 'store'])
            ->middleware([RequirePassword::class, 'throttle:10,1'])
            ->name('apiTokens.store');

        Route::delete('settings/api-tokens/{token}', [ApiTokensController::class, 'destroy'])
            ->whereUuid('token')
            ->name('apiTokens.destroy');
    });

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');
});

Route::get('.well-known/passkey-endpoints', fn () => response()->json([
    'enroll' => route('security.edit'),
    'manage' => route('security.edit'),
]))->name('well-known.passkeys');
