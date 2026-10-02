<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminCandidatesRequest;
use App\Models\User;
use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

class AdminCandidatesController extends Controller
{
    private const int MaxResults = 10;

    private const int RowsPerRead = 100;

    /**
     * A term holding a wildcard character gets near misses from SQL: rows are read until the list
     * is full of exact matches, so a near miss never takes the place of a match.
     */
    public function index(AdminCandidatesRequest $request): JsonResponse
    {
        $term = $request->string('query')->toString();

        $candidates = User::query()
            ->where('is_instance_admin', false)
            ->where(fn (Builder $query) => $query
                ->whereContains('name', $term)
                ->orWhereLike('email_key', SearchText::pattern($term), caseSensitive: true))
            ->orderBy('name')
            ->orderBy('id')
            ->lazy(self::RowsPerRead)
            ->filter(fn (User $user): bool => SearchText::contains($user->name, $term) || SearchText::contains($user->email, $term))
            ->take(self::MaxResults)
            ->values()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatarUrl' => $user->avatarUrl(),
            ]);

        return response()->json(['candidates' => $candidates->all()]);
    }
}
