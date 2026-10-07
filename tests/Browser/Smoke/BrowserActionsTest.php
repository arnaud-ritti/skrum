<?php

use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Route;

use function Amp\delay;

it('navigates once when a page takes longer than one second to answer', function () {
    $requests = 0;

    Route::get('/browser-actions/start', fn (): string => '<h1>Start</h1>');
    Route::get('/browser-actions/slow', function () use (&$requests): string {
        $requests++;
        delay(1.25);

        return '<h1>Destination</h1>';
    });

    browserVisit('/browser-actions/start')
        ->navigate('/browser-actions/slow')
        ->assertSee('Destination');

    expect($requests)->toBe(1);
});

it('submits once when a form takes longer than one second to redirect', function () {
    $submissions = 0;

    Route::get('/browser-actions/form', fn (): string => '<form method="post" action="/browser-actions/submit"><button>Save</button></form>');
    Route::post('/browser-actions/submit', function () use (&$submissions): RedirectResponse {
        $submissions++;
        delay(1.25);

        return redirect('/browser-actions/saved');
    });
    Route::get('/browser-actions/saved', fn (): string => '<h1>Saved</h1>');

    browserVisit('/browser-actions/form')
        ->click('Save')
        ->assertPathIs('/browser-actions/saved')
        ->assertSee('Saved');

    expect($submissions)->toBe(1);
});
