<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminCandidatesRequest;
use App\Models\User;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Http\JsonResponse;

class AdminCandidatesController extends Controller
{
    private const int MaxResults = 10;

    public function index(AdminCandidatesRequest $request): JsonResponse
    {
        $pattern = '%'.$this->escapeLike($request->string('query')->toString()).'%';

        $candidates = User::query()
            ->where('is_instance_admin', false)
            ->where(fn (Builder $query) => $query
                ->whereLike('name', $pattern)
                ->orWhereLike('email', $pattern))
            ->orderBy('name')
            ->orderBy('id')
            ->limit(self::MaxResults)
            ->get()
            ->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatarUrl' => $user->avatarUrl(),
            ]);

        return response()->json(['candidates' => $candidates->all()]);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
