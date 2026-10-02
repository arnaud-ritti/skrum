<?php

namespace App\Http\Middleware;

use App\Actions\ActionItems\ActionItemQuery;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Branding\BrandAssets;
use App\Support\CurrentTeamResolver;
use App\Support\InstanceSettings;
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
        $teamResolver = new CurrentTeamResolver($request);

        return [
            ...parent::share($request),
            'name' => fn (): string => resolve(InstanceSettings::class)->displayName(),
            'brand' => $this->brand(...),
            'adminUrl' => null,
            'auth' => [
                'user' => $this->user($request),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'locale' => app()->getLocale(),
            'locales' => config('skrum.locales'),
            'features' => [
                'mcp' => (bool) config('skrum.mcp.enabled'),
            ],
            'translations' => fn (): array => $this->translations(app()->getLocale()),
            'workspaces' => fn () => $request->user()?->workspaces()
                ->orderBy('name')
                ->get()
                ->map(fn (Workspace $workspace) => $workspace->only(['id', 'name', 'slug']))
                ->all() ?? [],
            'currentWorkspace' => fn (): ?array => $this->currentWorkspace($request),
            'teams' => fn (): array => $teamResolver->visibleTeams()
                ->map(fn (Team $team): array => $team->only(['id', 'name']))
                ->all(),
            'currentTeam' => fn (): ?array => $this->currentTeam($teamResolver),
            'notifications' => fn (): ?array => $request->user() === null
                ? null
                : ['unreadCount' => $request->user()->unreadNotifications()->count()],
            'actionItems' => fn (): ?array => $this->actionItemCounts($request),
        ];
    }

    /**
     * @return array{
     *     name: string,
     *     logoLightUrl: ?string,
     *     logoDarkUrl: ?string,
     *     faviconUrl: ?string,
     *     poweredBy: bool
     * }
     */
    private function brand(): array
    {
        $settings = resolve(InstanceSettings::class);
        $assets = resolve(BrandAssets::class);

        return [
            'name' => $settings->displayName(),
            'logoLightUrl' => $assets->url('logo-light'),
            'logoDarkUrl' => $assets->url('logo-dark'),
            'faviconUrl' => $assets->url('favicon'),
            'poweredBy' => $settings->poweredBy(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function user(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        return [...$user->toArray(), 'avatarUrl' => $user->avatarUrl()];
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     membersCount: int
     * }|null
     */
    private function currentTeam(CurrentTeamResolver $resolver): ?array
    {
        $team = $resolver->currentTeam();

        if ($team === null) {
            return null;
        }

        return [
            ...$team->only(['id', 'name']),
            'membersCount' => $team->members()->count(),
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

    /**
     * @return array{overdueAssignedCount: int}|null
     */
    private function actionItemCounts(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        $workspace = $request->route('workspace');

        if (! $workspace instanceof Workspace) {
            $workspace = $user->currentWorkspace;
        }

        if ($workspace === null || ! $user->belongsToWorkspace($workspace)) {
            return ['overdueAssignedCount' => 0];
        }

        return [
            'overdueAssignedCount' => resolve(ActionItemQuery::class)->visibleTo($user, $workspace)
                ->where('assignee_user_id', $user->id)
                ->whereNull('completed_at')
                ->where('due_on', '<', ActionItem::today()->toDateString())
                ->count(),
        ];
    }
}
