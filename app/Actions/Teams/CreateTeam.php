<?php

namespace App\Actions\Teams;

use App\Models\Team;
use App\Models\Workspace;
use App\Support\Teams\TeamSlug;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates a team without locking its workspace: each insert runs in its own (nested) transaction,
 * and a slug taken by a team created at the same moment is answered by the unique index.
 */
class CreateTeam
{
    public const int Attempts = 5;

    /** @param array<string, mixed> $attributes name, and optionally color, description, slug */
    public function handle(Workspace $workspace, array $attributes): Team
    {
        $chosenSlug = $attributes['slug'] ?? null;

        if (is_string($chosenSlug) && $chosenSlug !== '') {
            return $this->createWithChosenSlug($workspace, $attributes, $chosenSlug);
        }

        return $this->createWithDerivedSlug($workspace, $attributes);
    }

    public static function slugTaken(Workspace $workspace): ValidationException
    {
        return ValidationException::withMessages([
            'slug' => __('This link is already taken in :workspace.', ['workspace' => $workspace->name]),
        ]);
    }

    /** @param array<string, mixed> $attributes */
    private function createWithChosenSlug(Workspace $workspace, array $attributes, string $slug): Team
    {
        try {
            return DB::transaction(fn (): Team => $workspace->teams()->create([...$attributes, 'slug' => $slug]));
        } catch (UniqueConstraintViolationException) {
            throw self::slugTaken($workspace);
        }
    }

    /** @param array<string, mixed> $attributes */
    private function createWithDerivedSlug(Workspace $workspace, array $attributes): Team
    {
        $base = TeamSlug::fromName((string) $attributes['name']);
        $attempt = 1;

        while (true) {
            try {
                return DB::transaction(fn (): Team => $workspace->teams()->create([
                    ...$attributes,
                    'slug' => TeamSlug::availableIn($workspace->id, $base),
                ]));
            } catch (UniqueConstraintViolationException $exception) {
                if ($attempt >= self::Attempts) {
                    throw $exception;
                }

                $attempt++;
            }
        }
    }
}
