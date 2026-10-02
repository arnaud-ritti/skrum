<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstanceSettingKey;
use App\Support\Avatars\AvatarStyleCatalogue;
use App\Support\InstanceSettings;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BrandingUpdateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'brand_color' => ['nullable', 'string', 'regex:/^#[0-9a-f]{6}$/D'],
            'brand_radius' => ['nullable', 'integer', 'between:'.InstanceSettings::MinRadius.','.InstanceSettings::MaxRadius],
            'display_name' => ['nullable', 'string', 'max:60'],
            'powered_by' => ['nullable', 'boolean'],
            'avatar_style' => ['nullable', 'string', Rule::in(resolve(AvatarStyleCatalogue::class)->selectable())],
            'avatar_member_choice' => ['nullable', 'boolean'],
            'gif_provider' => ['nullable', 'string', Rule::in(InstanceSettings::GifProviders)],
            'gif_enabled' => ['nullable', 'boolean'],
            'gif_rating' => ['nullable', 'string', Rule::in(InstanceSettings::GifRatings)],
            'gif_key' => ['nullable', 'string', 'max:255'],
            'gif_key_clear' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'brand_color.regex' => __('Enter the colour as a 3- or 6-digit hex value, such as #2b63b0.'),
        ];
    }

    /**
     * The values to hand to InstanceSettings::setMany: null clears a setting (the form sends null for a field the admin
     * left on its default, so nothing gets pinned), and the GIF key is listed only when it changes.
     *
     * @return array<string, mixed>
     */
    public function settings(): array
    {
        $validated = $this->validated();

        $settings = [
            InstanceSettingKey::BrandColor->value => $validated['brand_color'] ?? null,
            InstanceSettingKey::BrandRadius->value => $validated['brand_radius'] ?? null,
            InstanceSettingKey::DisplayName->value => $validated['display_name'] ?? null,
            InstanceSettingKey::PoweredBy->value => $this->nullableBoolean('powered_by'),
            InstanceSettingKey::AvatarStyle->value => $validated['avatar_style'] ?? null,
            InstanceSettingKey::AvatarMemberChoice->value => $this->nullableBoolean('avatar_member_choice'),
            InstanceSettingKey::GifProvider->value => $validated['gif_provider'] ?? null,
            InstanceSettingKey::GifEnabled->value => $this->nullableBoolean('gif_enabled'),
            InstanceSettingKey::GifRating->value => $validated['gif_rating'] ?? null,
        ];

        $key = $validated['gif_key'] ?? null;

        if (is_string($key) && $key !== '') {
            return [...$settings, InstanceSettingKey::GifKey->value => $key];
        }

        if ($this->boolean('gif_key_clear')) {
            return [...$settings, InstanceSettingKey::GifKey->value => null];
        }

        return $settings;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'brand_color' => $this->normalisedColor($this->input('brand_color')),
            'display_name' => $this->withoutInvisibleCharacters($this->input('display_name')),
        ]);
    }

    private function nullableBoolean(string $field): ?bool
    {
        if ($this->input($field) === null) {
            return null;
        }

        return $this->boolean($field);
    }

    private function normalisedColor(mixed $color): mixed
    {
        if (! is_string($color)) {
            return $color;
        }

        $color = trim($color);

        if ($color === '') {
            return null;
        }

        if (preg_match('/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/D', $color, $matches) !== 1) {
            return $color;
        }

        $digits = strtolower($matches[1]);

        if (strlen($digits) === 3) {
            $digits = "{$digits[0]}{$digits[0]}{$digits[1]}{$digits[1]}{$digits[2]}{$digits[2]}";
        }

        return "#{$digits}";
    }

    /**
     * Control characters, bidirectional controls, the zero-width space and the byte-order mark go; the zero-width
     * joiner and non-joiner stay, because joined emoji and Persian or Indic spellings need them.
     */
    private function withoutInvisibleCharacters(mixed $name): mixed
    {
        if (! is_string($name)) {
            return $name;
        }

        $name = trim((string) preg_replace('/[\p{Cc}\x{200B}\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{FEFF}]+/u', '', $name));

        return preg_match('/^[\x{200C}\x{200D}\s]*$/u', $name) === 1 ? null : $name;
    }
}
