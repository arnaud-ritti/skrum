<?php

use App\Http\Controllers\CurrentWorkspaceController;
use App\Http\Controllers\LocalesController;
use App\Http\Controllers\WorkspacesController;
use App\Http\Middleware\RememberCurrentWorkspace;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::put('locale', [LocalesController::class, 'update'])->name('locale.update');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [CurrentWorkspaceController::class, 'show'])->name('dashboard');
    Route::get('workspaces/create', [WorkspacesController::class, 'create'])->name('workspaces.create');
    Route::post('workspaces', [WorkspacesController::class, 'store'])->name('workspaces.store');

    Route::prefix('w/{workspace}')
        ->middleware(['can:view,workspace', RememberCurrentWorkspace::class])
        ->scopeBindings()
        ->group(function () {
            Route::get('/', [WorkspacesController::class, 'show'])->name('workspaces.show');
            Route::delete('/', [WorkspacesController::class, 'destroy'])->name('workspaces.destroy');
        });
});

require __DIR__.'/settings.php';
