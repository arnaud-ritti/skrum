<?php

namespace App\Http\Requests\Teams;

use App\Actions\Retros\TemplateAvailability;
use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\WorkspaceTemplate;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class TeamDefaultRetroTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageRituals', $this->route('team')) ?? false;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'template' => ['nullable', 'string', 'max:80', $this->availableToTheTeam(...)],
        ];
    }

    public function template(): ?string
    {
        $template = $this->validated('template');

        return $template === null ? null : (string) $template;
    }

    private function availableToTheTeam(string $attribute, mixed $value, Closure $fail): void
    {
        /** @var Team $team */
        $team = $this->route('team');

        if (! resolve(TemplateAvailability::class)->isAvailable($team, $this->user(), $value)) {
            $fail(__('Choose a template from the list.'));

            return;
        }

        $templateId = WorkspaceTemplate::idFromKey((string) $value);

        if ($templateId === null) {
            return;
        }

        if (WorkspaceTemplate::query()->whereKey($templateId)->where('visibility', TemplateVisibility::Personal->value)->exists()) {
            $fail(__('A personal template cannot be the team default.'));
        }
    }
}
