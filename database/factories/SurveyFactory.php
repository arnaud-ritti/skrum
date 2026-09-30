<?php

namespace Database\Factories;

use App\Enums\SurveyKind;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Survey;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Survey>
 */
class SurveyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'created_by_participant_id' => fn (array $attributes) => Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'kind' => SurveyKind::Single,
            'question' => fake()->sentence().'?',
            'position' => 0,
        ];
    }

    public function single(): static
    {
        return $this->state(fn () => ['kind' => SurveyKind::Single]);
    }

    public function multiple(): static
    {
        return $this->state(fn () => ['kind' => SurveyKind::Multiple]);
    }

    public function text(): static
    {
        return $this->state(fn () => ['kind' => SurveyKind::Text]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['is_closed' => true]);
    }

    /**
     * @param  array<int, string>  $labels
     */
    public function withOptions(array $labels = ['Yes', 'No', 'Maybe']): static
    {
        return $this->afterCreating(function (Survey $survey) use ($labels): void {
            foreach ($labels as $position => $label) {
                $survey->options()->create(['label' => $label, 'position' => $position]);
            }
        });
    }
}
