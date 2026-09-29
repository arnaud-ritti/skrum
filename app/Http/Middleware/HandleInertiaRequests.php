<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'locale' => app()->getLocale(),
            'locales' => config('skrum.locales'),
            'translations' => fn () => $this->translations(app()->getLocale()),
            'workspaces' => fn () => $request->user()?->workspaces()
                ->orderBy('name')
                ->get()
                ->map(fn (Workspace $workspace) => $workspace->only(['id', 'name', 'slug']))
                ->all() ?? [],
            'currentWorkspace' => fn () => $this->currentWorkspace($request),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function translations(string $locale): array
    {
        $path = lang_path("{$locale}.json");

        if (! is_file($path)) {
            return [];
        }

        return json_decode((string) file_get_contents($path), true) ?? [];
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     slug: string,
     *     role: string
     * }|null
     */
    private function currentWorkspace(Request $request): ?array
    {
        $user = $request->user();
        $workspace = $request->route('workspace');

        if ($user === null) {
            return null;
        }

        if (! $workspace instanceof Workspace) {
            $workspace = $user->currentWorkspace;
        }

        $role = $workspace === null ? null : $user->roleIn($workspace);

        if ($role === null) {
            return null;
        }

        return [
            ...$workspace->only(['id', 'name', 'slug']),
            'role' => $role->value,
        ];
    }
}
