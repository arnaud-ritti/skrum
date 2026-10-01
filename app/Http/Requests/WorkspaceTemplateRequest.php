<?php

namespace App\Http\Requests;

use App\Enums\ColumnColor;
use App\Enums\TemplateCategory;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class WorkspaceTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageTemplates', $this->workspace()) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'category' => ['required', Rule::enum(TemplateCategory::class)],
            'columns' => ['required', 'array', 'min:1', 'max:10'],
            'columns.*.title' => ['required', 'string', 'max:100'],
            'columns.*.description' => ['nullable', 'string', 'max:200'],
            'columns.*.color' => ['required', Rule::enum(ColumnColor::class)],
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
     *     category: string
     * }
     */
    public function templateAttributes(): array
    {
        return [
            'name' => (string) $this->validated('name'),
            'category' => (string) $this->validated('category'),
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

    private function nameIsTaken(): bool
    {
        $template = $this->route('template');
        $ignoredId = $template instanceof WorkspaceTemplate ? $template->id : null;

        return $this->workspace()->templates()
            ->whereRaw('lower(name) = ?', [mb_strtolower((string) $this->input('name'))])
            ->when($ignoredId !== null, fn ($query) => $query->whereKeyNot($ignoredId))
            ->exists();
    }
}
