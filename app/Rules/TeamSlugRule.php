<?php

namespace App\Rules;

use App\Models\Team;
use App\Models\Workspace;
use App\Support\Teams\TeamSlug;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A slug typed by someone: of the TeamSlug form and free in the workspace. The unique index
 * still answers when two edits race; the caller maps that to the same message.
 */
class TeamSlugRule implements ValidationRule
{
    public function __construct(private ?Workspace $workspace, private ?string $exceptTeamId = null) {}

    /** @return array<int, mixed> */
    public static function rules(?Workspace $workspace, ?string $exceptTeamId = null): array
    {
        return ['string', 'min:'.TeamSlug::MinLength, 'max:'.TeamSlug::MaxLength, new self($workspace, $exceptTeamId)];
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        if (preg_match(TeamSlug::Pattern, $value) !== 1) {
            $fail(__('Use lower-case letters, digits and hyphens.'));

            return;
        }

        if ($this->workspace === null) {
            return;
        }

        $isTaken = Team::query()
            ->where('workspace_id', $this->workspace->id)
            ->where('slug', $value)
            ->when($this->exceptTeamId !== null, fn ($query) => $query->whereKeyNot($this->exceptTeamId))
            ->exists();

        if ($isTaken) {
            $fail(__('This link is already taken in :workspace.', ['workspace' => $this->workspace->name]));
        }
    }
}
