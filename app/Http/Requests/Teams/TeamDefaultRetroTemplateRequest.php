<?php

namespace App\Http\Requests\Teams;

use App\Actions\Retros\TemplateAvailability;
use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class TeamDefaultRetroTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        $team = $this->route('team');

        if (! $team instanceof Team) {
            return false;
        }

        return $this->user()?->can('manageRituals', $team) ?? false;
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
        $team = $this->route('team');
        $user = $this->user();

        if (! $team instanceof Team || ! $user instanceof User) {
            $fail(__('Choose a template from the list.'));

            return;
        }

        if (! resolve(TemplateAvailability::class)->isAvailable($team, $user, $value)) {
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
