<?php

namespace App\Http\Requests;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;
use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\Database\NameKey;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class WorkspaceTemplateRequest extends FormRequest
{
    public const MaxColumns = 10;

    public function authorize(): bool
    {
        $user = $this->user();

        if ($user === null) {
            return false;
        }

        $template = $this->route('template');

        if ($template instanceof WorkspaceTemplate && $user->cannot('update', $template)) {
            return false;
        }

        return $user->can('share', [WorkspaceTemplate::class, $this->workspace(), $this->visibility(), $this->sharedTeam()]);
    }

    /**
     * The visibility asked for; a new template without one is a workspace template, an edited one keeps its own.
     */
    public function visibility(): TemplateVisibility
    {
        $template = $this->route('template');
        $fallback = $template instanceof WorkspaceTemplate ? $template->visibility : TemplateVisibility::Workspace;

        return TemplateVisibility::tryFrom((string) $this->input('visibility')) ?? $fallback;
    }

    public function sharedTeam(): ?Team
    {
        if ($this->visibility() !== TemplateVisibility::Team) {
            return null;
        }

        $teamId = $this->input('team_id');

        if (! is_string($teamId)) {
            return null;
        }

        if (! Str::isUuid($teamId)) {
            return null;
        }

        return $this->workspace()->teams()->whereKey($teamId)->first();
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'category' => ['required', Rule::enum(TemplateCategory::class)],
            'columns' => ['required', 'array', 'min:1', 'max:'.self::MaxColumns],
            'columns.*.title' => ['required', 'string', 'max:100'],
            'columns.*.description' => ['nullable', 'string', 'max:200'],
            'columns.*.color' => ['required', Rule::enum(ColumnColor::class)],
            'visibility' => ['sometimes', Rule::enum(TemplateVisibility::class)],
            'team_id' => ['nullable', 'uuid', Rule::prohibitedIf(fn (): bool => $this->visibility() !== TemplateVisibility::Team)],
        ];
    }

    /**
     * @return array<int, Closure>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('name')) {
                    return;
                }

                if (! $this->nameIsTaken()) {
                    return;
                }

                $validator->errors()->add('name', __('A template with this name already exists.'));
            },
        ];
    }

    /**
     * @return array{
     *     name: string,
     *     category: string,
     *     visibility: string,
     *     team_id: ?string
     * }
     */
    public function templateAttributes(): array
    {
        return [
            'name' => (string) $this->validated('name'),
            'category' => (string) $this->validated('category'),
            'visibility' => $this->visibility()->value,
            'team_id' => $this->sharedTeam()?->id,
        ];
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: ?string,
     *     color: string
     * }>
     */
    public function templateColumns(): array
    {
        /** @var array<int, array{title: string, description?: ?string, color: string}> $columns */
        $columns = array_values($this->validated('columns'));

        return array_map(fn (array $column): array => [
            'title' => $column['title'],
            'description' => $column['description'] ?? null,
            'color' => $column['color'],
        ], $columns);
    }

    private function workspace(): Workspace
    {
        $workspace = $this->route('workspace');

        abort_unless($workspace instanceof Workspace, 404);

        return $workspace;
    }

    /**
     * Asked again by the controller once the workspace row is locked: the rule ran before the lock,
     * and two requests may have passed it together.
     */
    public function nameIsTaken(): bool
    {
        $template = $this->route('template');
        $ignoredId = $template instanceof WorkspaceTemplate ? $template->id : null;

        return $this->workspace()->templates()
            ->where('name_key', NameKey::of((string) $this->input('name')))
            ->when($ignoredId !== null, fn ($query) => $query->whereKeyNot($ignoredId))
            ->exists();
    }
}
