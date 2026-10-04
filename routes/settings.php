<?php

use App\Http\Controllers\Settings\AccountSettingsController;
use App\Http\Controllers\Settings\ApiTokensController;
use App\Http\Controllers\Settings\BrowserSessionsController;
use App\Http\Controllers\Settings\EmailSecondFactorCodesController;
use App\Http\Controllers\Settings\EmailSecondFactorsController;
use App\Http\Controllers\Settings\LinkedAccountsController;
use App\Http\Controllers\Settings\MotionPreferencesController;
use App\Http\Controllers\Settings\NotificationPreferencesController;
use App\Http\Controllers\Settings\OtherBrowserSessionsController;
use App\Http\Controllers\Settings\PasswordBreachRangesController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\ProfilePhotosController;
use App\Http\Controllers\Settings\SecurityController;
use App\Http\Controllers\Settings\ShortcutPreferencesController;
use App\Http\Middleware\EnsureMcpIsEnabled;
use App\Http\Middleware\RequirePasswordUnlessNoneKnown;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function (): void {
    Route::get('settings', [AccountSettingsController::class, 'edit'])->name('settings.edit');

    Route::redirect('settings/profile', '/settings#profile')->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('settings/profile/photo', [ProfilePhotosController::class, 'store'])->middleware('throttle:10,1,profilePhotos')->name('profilePhotos.store');
    Route::delete('settings/profile/photo', [ProfilePhotosController::class, 'destroy'])->name('profilePhotos.destroy');
});

Route::middleware(['auth', 'verified'])->group(function (): void {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    /*
     * The two sections that say something about the account behind a
     * confirmed password are opened through these addresses: they ask for
     * the password, then lead to the section.
     */
    Route::redirect('settings/security', '/settings#security')
        ->middleware(RequirePasswordUnlessNoneKnown::class)
        ->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1,passwordUpdates')
        ->name('user-password.update');

    Route::post('settings/password/breach-range', [PasswordBreachRangesController::class, 'store'])
        ->middleware('throttle:30,1,passwordBreachRanges')
        ->name('passwordBreachRanges.store');

    Route::middleware([RequirePasswordUnlessNoneKnown::class, 'throttle:6,1,emailSecondFactor'])->group(function (): void {
        Route::post('settings/email-second-factor/code', [EmailSecondFactorCodesController::class, 'store'])->name('emailSecondFactor.codes.store');
        Route::post('settings/email-second-factor', [EmailSecondFactorsController::class, 'store'])->name('emailSecondFactor.store');
        Route::delete('settings/email-second-factor', [EmailSecondFactorsController::class, 'destroy'])->name('emailSecondFactor.destroy');
    });

    Route::delete('settings/sessions/{sessionKey}', [BrowserSessionsController::class, 'destroy'])
        ->where('sessionKey', '[0-9a-f]{64}')
        ->middleware(RequirePasswordUnlessNoneKnown::class)
        ->name('browserSessions.destroy');

    Route::delete('settings/sessions', [OtherBrowserSessionsController::class, 'destroy'])
        ->middleware(RequirePasswordUnlessNoneKnown::class)
        ->name('otherBrowserSessions.destroy');

    Route::get('settings/linked-accounts/{provider}', [LinkedAccountsController::class, 'create'])
        ->middleware(RequirePasswordUnlessNoneKnown::class)
        ->name('linkedAccounts.create');

    Route::delete('settings/linked-accounts/{socialAccount}', [LinkedAccountsController::class, 'destroy'])
        ->whereUuid('socialAccount')
        ->middleware(RequirePasswordUnlessNoneKnown::class)
        ->name('linkedAccounts.destroy');

    Route::redirect('settings/notifications', '/settings#notifications')->name('notificationPreferences.edit');
    Route::patch('settings/notifications', [NotificationPreferencesController::class, 'update'])->name('notificationPreferences.update');

    Route::patch('settings/shortcuts', [ShortcutPreferencesController::class, 'update'])->name('shortcutPreferences.update');
    Route::patch('settings/motion', [MotionPreferencesController::class, 'update'])->name('motionPreferences.update');

    Route::middleware(EnsureMcpIsEnabled::class)->group(function (): void {
        Route::redirect('settings/api-tokens', '/settings#api-tokens')
            ->middleware(RequirePasswordUnlessNoneKnown::class)
            ->name('apiTokens.index');

        Route::post('settings/api-tokens', [ApiTokensController::class, 'store'])
            ->middleware([RequirePasswordUnlessNoneKnown::class, 'throttle:10,1,apiTokens'])
            ->name('apiTokens.store');

        Route::delete('settings/api-tokens/{token}', [ApiTokensController::class, 'destroy'])
            ->middleware(RequirePasswordUnlessNoneKnown::class)
            ->whereUuid('token')
            ->name('apiTokens.destroy');
    });

    Route::redirect('settings/appearance', '/settings#appearance')->name('appearance.edit');
});

Route::get('.well-known/passkey-endpoints', fn () => response()->json([
    'enroll' => route('security.edit'),
    'manage' => route('security.edit'),
]))->name('well-known.passkeys');
