<?php

use App\Http\Controllers\StatusPagesController;
use Illuminate\Support\Facades\Route;

/*
 * Public instance status (spec §9.12): outside the web group, so no session,
 * cookie or CSRF token, and excepted from maintenance mode in bootstrap/app.php.
 */
Route::get('status', [StatusPagesController::class, 'show'])->name('status.show');
