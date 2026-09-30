<?php

namespace Database\Factories;

use App\Enums\IntegrationProvider;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItemExternalLink>
 */
class ActionItemExternalLinkFactory extends Factory
{
    public function definition(): array
    {
        $number = fake()->unique()->numberBetween(1, 99999);

        return [
            'action_item_id' => ActionItem::factory(),
            'source' => IntegrationProvider::Jira,
            'external_site' => 'cloud-1',
            'external_id' => (string) (10000 + $number),
            'external_key' => "PROJ-{$number}",
            'external_url' => "https://acme.atlassian.net/browse/PROJ-{$number}",
        ];
    }

    public function linear(): static
    {
        return $this->state(function () {
            $number = fake()->unique()->numberBetween(1, 99999);

            return [
                'source' => IntegrationProvider::Linear,
                'external_site' => 'org-1',
                'external_id' => fake()->uuid(),
                'external_key' => "ENG-{$number}",
                'external_url' => "https://linear.app/acme/issue/ENG-{$number}",
            ];
        });
    }
}
