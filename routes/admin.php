<?php

use App\Http\Controllers\Admin\AdminCandidatesController;
use App\Http\Controllers\Admin\AdminsController;
use App\Http\Controllers\Admin\AvatarPreviewsController;
use App\Http\Controllers\Admin\BrandingAssetsController;
use App\Http\Controllers\Admin\BrandingController;
use App\Http\Controllers\Admin\BrandingPreviewsController;
use App\Http\Middleware\KeepFlashedSessionData;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified', 'can:manageInstance'])->group(function (): void {
    Route::get('admin', fn () => to_route('admin.branding.edit'))->name('admin.index');

    Route::get('admin/branding/preview', [BrandingPreviewsController::class, 'show'])
        ->middleware(['throttle:120,1,brandingPreviews', KeepFlashedSessionData::class])
        ->name('admin.brandingPreview.show');

    Route::get('admin/avatar-previews/{style}/{seed}.svg', [AvatarPreviewsController::class, 'show'])
        ->where(['style' => '[a-z0-9-]+', 'seed' => '[a-f0-9]{32}'])
        ->middleware(KeepFlashedSessionData::class)
        ->name('admin.avatarPreviews.show');

    Route::middleware(RequirePassword::class)->group(function (): void {
        Route::get('admin/branding', [BrandingController::class, 'edit'])->name('admin.branding.edit');
        Route::put('admin/branding', [BrandingController::class, 'update'])->name('admin.branding.update');
        Route::delete('admin/branding', [BrandingController::class, 'destroy'])->name('admin.branding.destroy');

        Route::post('admin/branding/assets/{asset}', [BrandingAssetsController::class, 'store'])
            ->where('asset', 'logo-light|logo-dark|favicon')
            ->name('admin.brandingAssets.store');
        Route::delete('admin/branding/assets/{asset}', [BrandingAssetsController::class, 'destroy'])
            ->where('asset', 'logo-light|logo-dark|favicon')
            ->name('admin.brandingAssets.destroy');

        Route::get('admin/admins', [AdminsController::class, 'index'])->name('admin.admins.index');
        Route::post('admin/admins', [AdminsController::class, 'store'])->name('admin.admins.store');
        Route::delete('admin/admins/{user}', [AdminsController::class, 'destroy'])
            ->whereUuid('user')
            ->name('admin.admins.destroy');
        Route::get('admin/admins/candidates', [AdminCandidatesController::class, 'index'])
            ->middleware(['throttle:60,1,adminCandidates', KeepFlashedSessionData::class])
            ->name('admin.adminCandidates.index');
    });
});
