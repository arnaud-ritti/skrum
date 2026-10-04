<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UsersIndexRequest;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Builder;
use Inertia\Inertia;
use Inertia\Response;

class UsersController extends Controller
{
    private const int PerPage = 25;

    /**
     * A term holding a wildcard character may bring a near miss from SQL: the page holds at most
     * 25 rows, and a near miss there is acceptable for an admin search.
     */
    public function index(UsersIndexRequest $request, SecondFactors $secondFactors): Response
    {
        $term = $request->searchTerm();
        $status = $request->status();
        $viewer = $request->user();

        $users = User::query()
            ->withCount('workspaces')
            ->when($status === UsersIndexRequest::StatusActive, fn (Builder $query) => $query->whereNull('deactivated_at'))
            ->when($status === UsersIndexRequest::StatusDeactivated, fn (Builder $query) => $query->whereNotNull('deactivated_at'))
            ->when($status === UsersIndexRequest::StatusAdmins, fn (Builder $query) => $query->where('is_instance_admin', true))
            ->when($term !== null, fn (Builder $query) => $query->where(fn (Builder $match) => $match
                ->whereContains('name', (string) $term)
                ->orWhereLike('email_key', SearchText::pattern((string) $term), caseSensitive: true)))
            ->latest()
            ->orderByDesc('id')
            ->paginate(self::PerPage)
            ->withQueryString()
            ->through(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatarUrl' => $user->avatarUrl(),
                'isAdmin' => $user->is_instance_admin,
                'isDeactivated' => $user->isDeactivated(),
                'hasSecondFactor' => $secondFactors->requiredFor($user),
                'workspacesCount' => (int) $user->getAttribute('workspaces_count'),
                'createdAt' => $user->created_at?->toIso8601String(),
                'lastSignedInAt' => $user->last_signed_in_at?->toIso8601String(),
                'isSelf' => $user->is($viewer),
            ]);

        return Inertia::render('admin/users', [
            'users' => $users,
            'filters' => [
                'query' => $term,
                'status' => $status,
            ],
            'activeAdminCount' => User::query()
                ->where('is_instance_admin', true)
                ->whereNull('deactivated_at')
                ->count(),
        ]);
    }
}
