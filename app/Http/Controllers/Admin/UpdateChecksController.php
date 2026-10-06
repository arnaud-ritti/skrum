<?php

namespace App\Http\Controllers\Admin;

use App\Actions\Admin\CheckForUpdate;
use App\Http\Controllers\Controller;
use App\Support\InstanceVersion;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class UpdateChecksController extends Controller
{
    public function store(CheckForUpdate $checkForUpdate, InstanceVersion $version): RedirectResponse
    {
        $latest = $checkForUpdate->handle();

        Inertia::flash('toast', $this->outcome($latest, $version));

        return back();
    }

    /**
     * @return array{
     *     type: 'success'|'info'|'error',
     *     message: string
     * }
     */
    private function outcome(?string $latest, InstanceVersion $version): array
    {
        if ($latest === null) {
            return ['type' => 'error', 'message' => __('The release feed could not be reached. Try again later.')];
        }

        return match ($version->status()['state']) {
            'outdated' => ['type' => 'success', 'message' => __('Version :version is available.', ['version' => $latest])],
            'unreleased' => ['type' => 'info', 'message' => __('This build is not a release: it is not compared with new versions.')],
            default => ['type' => 'success', 'message' => __("You're on the latest version.")],
        };
    }
}
