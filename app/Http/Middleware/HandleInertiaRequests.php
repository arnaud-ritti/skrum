<?php

namespace App\Http\Middleware;

use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\Notifications\BellNotifications;
use App\Actions\Sessions\CountLiveTeamSessions;
use App\Actions\Teams\TeamSettingsSections;
use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMembership;
use App\Support\Alphabetical;
use App\Support\Auth\SignInPolicy;
use App\Support\Branding\BrandAssets;
use App\Support\CurrentTeamResolver;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;
use Illuminate\Database\Eloquent\Builder;
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

    public function __construct(private TeamSettingsSections $teamSettingsSections) {}

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
            'demo' => [
                'enabled' => (bool) config('skrum.demo.enabled'),
                'resetTime' => (string) config('skrum.demo.reset_time'),
                'timezone' => (string) config('app.timezone'),
            ],
            'name' => fn (): string => resolve(InstanceSettings::class)->displayName(),
            'brand' => $this->brand(...),
            'adminUrl' => fn (): ?string => $request->user()?->can('manageInstance')
                ? route('admin.index')
                : null,
            'signInAlert' => fn (): ?string => $request->user()?->can('manageInstance') && resolve(SignInPolicy::class)->isIgnored()
                ? 'sso_required_ignored'
                : null,
            'ssoInForce' => fn (): bool => $request->user()?->can('manageInstance') === true && resolve(SignInPolicy::class)->ssoRequired(),
            'integrationCounts' => fn (): ?array => $request->user()?->can('manageInstance')
                ? $this->integrationCounts()
                : null,
            'auth' => [
                'user' => $this->user($request),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'locale' => app()->getLocale(),
            'locales' => config('skrum.locales'),
            'features' => [
                'mcp' => (bool) config('skrum.mcp.enabled'),
                'integrations' => IntegrationProvider::anyEnabled(),
            ],
            'translations' => fn (): array => $this->translations(app()->getLocale()),
            'workspaces' => fn (): array => $this->workspaces($request),
            'currentWorkspace' => fn (): ?array => $this->currentWorkspace($request),
            'teams' => fn (): array => $teamResolver->visibleTeams()
                ->map(fn (Team $team): array => $team->only(['id', 'name']))
                ->all(),
            'currentTeam' => fn (): ?array => $this->currentTeam($teamResolver, $request),
            'notifications' => fn (): ?array => $request->user() === null
                ? null
                : ['unreadCount' => resolve(BellNotifications::class)->unreadCount($request->user())],
            'actionItems' => fn (): ?array => $this->actionItemCounts($request),
            'liveSessions' => fn (): ?array => $this->liveSessions($teamResolver, $request),
            'instanceVersion' => fn (): ?string => $request->user() === null
                ? null
                : resolve(InstanceVersion::class)->current(),
            'instanceVersionStatus' => fn (): ?array => $request->user()?->can('manageInstance')
                ? resolve(InstanceVersion::class)->status()
                : null,
        ];
    }

    /**
     * The integration providers turned on, out of those configured, for the badge of the admin navigation.
     *
     * @return array{
     *     enabled: int,
     *     configured: int
     * }
     */
    private function integrationCounts(): array
    {
        $configured = array_filter(IntegrationProvider::cases(), fn (IntegrationProvider $provider): bool => $provider->isConfigured());

        return [
            'enabled' => count(IntegrationProvider::enabled()),
            'configured' => count($configured),
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
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     slug: string,
     *     teamsCount: int,
     *     role: string
     * }>
     */
    private function workspaces(Request $request): array
    {
        $user = $request->user();

        if ($user === null) {
            return [];
        }

        $workspaces = $user->workspaces()
            ->withCount([
                'teams',
                'teams as member_teams_count' => fn (Builder $teams) => $teams
                    ->whereHas('members', fn (Builder $members) => $members->whereKey($user->id)),
            ])
            ->orderBy('workspaces.id')
            ->get();

        return Alphabetical::sort($workspaces, fn (Workspace $workspace): string => $workspace->name)
            ->map(function (Workspace $workspace): array {
                $role = $this->membershipOf($workspace)->role;

                return [
                    ...$workspace->only(['id', 'name', 'slug']),
                    'teamsCount' => $role->canManageWorkspace() ? $workspace->teams_count : $workspace->member_teams_count,
                    'role' => $role->value,
                ];
            })
            ->all();
    }

    private function membershipOf(Workspace $workspace): WorkspaceMembership
    {
        return $workspace->getRelation('membership');
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     membersCount: int,
     *     viewerRole: ?string,
     *     settingsUrl: ?string,
     *     settingsSections: ?array{
     *         general: bool,
     *         sprints: bool,
     *         retros: bool,
     *         health: bool,
     *         integrations: bool,
     *         data: bool
     *     },
     *     canCreateSession: bool
     * }|null
     */
    private function currentTeam(CurrentTeamResolver $resolver, Request $request): ?array
    {
        $team = $resolver->currentTeam();

        if ($team === null) {
            return null;
        }

        $user = $request->user();
        $settings = $user === null ? null : $this->teamSettingsSections->handle($user, $team);
        $sections = $settings;

        if ($sections !== null) {
            unset($sections['firstUrl']);
        }

        return [
            'id' => $team->id,
            'name' => $team->name,
            'membersCount' => $team->members()->count(),
            'viewerRole' => $user === null ? null : $team->roleOf($user)?->value,
            'settingsUrl' => $settings['firstUrl'] ?? null,
            'settingsSections' => $sections,
            // The five kinds of session share one rule (TeamPolicy::takesPart): asking for one answers for all, on every page.
            'canCreateSession' => $user?->can('createRetro', $team) ?? false,
        ];
    }

    /**
     * @return array{count: int}|null
     */
    private function liveSessions(CurrentTeamResolver $resolver, Request $request): ?array
    {
        $team = $resolver->currentTeam();
        $user = $request->user();

        if ($team === null || $user === null) {
            return null;
        }

        return ['count' => resolve(CountLiveTeamSessions::class)->handle($team, $user)];
    }

    /**
     * @return array<string, string>
     */
    public function translations(string $locale): array
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
     *     role: string,
     *     canManageMembers: bool
     * }|null
     */
    private function currentWorkspace(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        $workspace = $this->workspaceFor($request, $user);
        $role = $workspace === null ? null : $user->roleIn($workspace);

        if ($role === null) {
            return null;
        }

        return [
            ...$workspace->only(['id', 'name', 'slug']),
            'role' => $role->value,
            'canManageMembers' => $user->can('manageMembers', $workspace),
        ];
    }

    private function workspaceFor(Request $request, User $user): ?Workspace
    {
        $workspace = $request->route('workspace');

        return $workspace instanceof Workspace ? $workspace : $user->currentWorkspace;
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

        $workspace = $this->workspaceFor($request, $user);

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
