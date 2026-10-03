<?php

use App\Enums\SsoProvider;
use App\Http\Controllers\Admin\AdminCandidatesController;
use App\Http\Controllers\Admin\AdminsController;
use App\Http\Controllers\Admin\AuditEventsController;
use App\Http\Controllers\Admin\AvatarPreviewsController;
use App\Http\Controllers\Admin\BrandingAssetsController;
use App\Http\Controllers\Admin\BrandingController;
use App\Http\Controllers\Admin\BrandingPreviewsController;
use App\Http\Controllers\Admin\GeneralSettingsController;
use App\Http\Controllers\Admin\LicencesController;
use App\Http\Controllers\Admin\McpKeysController;
use App\Http\Controllers\Admin\SignInConfirmationsController;
use App\Http\Controllers\Admin\SignInSettingsController;
use App\Http\Controllers\Admin\SsoConnectionTestsController;
use App\Http\Controllers\Admin\SsoProvidersController;
use App\Http\Controllers\Admin\UserDeactivationsController;
use App\Http\Controllers\Admin\UsersController;
use App\Http\Middleware\KeepFlashedSessionData;
use App\Support\Branding\BrandAssets;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'can:manageInstance'])->group(function (): void {
    Route::get('admin', fn () => to_route('admin.general.edit'))->name('admin.index');

    Route::get('admin/branding/preview', [BrandingPreviewsController::class, 'show'])
        ->middleware(['throttle:120,1,brandingPreviews', KeepFlashedSessionData::class])
        ->name('admin.brandingPreview.show');

    Route::get('admin/avatar-previews/{style}/{seed}.svg', [AvatarPreviewsController::class, 'show'])
        ->where(['style' => '[a-z0-9-]+', 'seed' => '[a-f0-9]{32}'])
        ->middleware(KeepFlashedSessionData::class)
        ->name('admin.avatarPreviews.show');

    Route::middleware(RequirePassword::class)->group(function (): void {
        Route::get('admin/general', [GeneralSettingsController::class, 'edit'])->name('admin.general.edit');
        Route::put('admin/general', [GeneralSettingsController::class, 'update'])->name('admin.general.update');

        Route::get('admin/branding', [BrandingController::class, 'edit'])->name('admin.branding.edit');
        Route::put('admin/branding', [BrandingController::class, 'update'])->name('admin.branding.update');
        Route::delete('admin/branding', [BrandingController::class, 'destroy'])->name('admin.branding.destroy');

        Route::get('admin/sign-in', [SignInSettingsController::class, 'edit'])->name('admin.signIn.edit');
        Route::put('admin/sign-in', [SignInSettingsController::class, 'update'])->name('admin.signIn.update');
        Route::get('admin/sign-in/confirm', [SignInConfirmationsController::class, 'create'])->name('admin.signInConfirmation.create');
        Route::put('admin/sign-in/providers/{provider}', [SsoProvidersController::class, 'update'])
            ->whereIn('provider', array_column(SsoProvider::cases(), 'value'))
            ->name('admin.ssoProviders.update');
        Route::post('admin/sign-in/tests', [SsoConnectionTestsController::class, 'store'])
            ->middleware('throttle:10,1,ssoTests')
            ->name('admin.ssoTests.store');

        Route::post('admin/branding/assets/{asset}', [BrandingAssetsController::class, 'store'])
            ->where('asset', BrandAssets::RoutePattern)
            ->name('admin.brandingAssets.store');
        Route::delete('admin/branding/assets/{asset}', [BrandingAssetsController::class, 'destroy'])
            ->where('asset', BrandAssets::RoutePattern)
            ->name('admin.brandingAssets.destroy');

        Route::get('admin/admins', [AdminsController::class, 'index'])->name('admin.admins.index');
        Route::post('admin/admins', [AdminsController::class, 'store'])->name('admin.admins.store');
        Route::delete('admin/admins/{user}', [AdminsController::class, 'destroy'])
            ->whereUuid('user')
            ->name('admin.admins.destroy');
        Route::get('admin/admins/candidates', [AdminCandidatesController::class, 'index'])
            ->middleware(['throttle:60,1,adminCandidates', KeepFlashedSessionData::class])
            ->name('admin.adminCandidates.index');

        Route::get('admin/mcp-keys', [McpKeysController::class, 'index'])->name('admin.mcpKeys.index');
        Route::delete('admin/mcp-keys/{token}', [McpKeysController::class, 'destroy'])
            ->whereUuid('token')
            ->name('admin.mcpKeys.destroy');

        Route::get('admin/users', [UsersController::class, 'index'])->name('admin.users.index');
        Route::post('admin/users/{user}/deactivation', [UserDeactivationsController::class, 'store'])
            ->whereUuid('user')
            ->name('admin.userDeactivations.store');
        Route::delete('admin/users/{user}/deactivation', [UserDeactivationsController::class, 'destroy'])
            ->whereUuid('user')
            ->name('admin.userDeactivations.destroy');

        Route::get('admin/licence', [LicencesController::class, 'show'])->name('admin.licence.show');

        Route::get('admin/audit-log', [AuditEventsController::class, 'index'])->name('admin.auditEvents.index');
    });
});
