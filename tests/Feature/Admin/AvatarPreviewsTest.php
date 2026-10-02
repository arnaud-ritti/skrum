<?php

use App\Models\User;
use App\Support\Avatars\AvatarStyleCatalogue;

const AvatarPreviewSeed = '5f2b8c1e9a4d47f0b3c6d8e1a7f90214';

it('renders the asked style for an admin with inert headers', function () {
    $this->actingAs(User::factory()->instanceAdmin()->create());

    $thumbs = $this->get(route('admin.avatarPreviews.show', ['style' => 'thumbs', 'seed' => AvatarPreviewSeed]))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox");

    $rings = $this->get(route('admin.avatarPreviews.show', ['style' => 'rings', 'seed' => AvatarPreviewSeed]))->assertOk();

    expect($thumbs->getContent())->toStartWith('<svg')
        ->not->toBe($rings->getContent())
        ->and($thumbs->headers->get('Cache-Control'))->toContain('private');
});

it('is closed to non-admins and guests', function () {
    $url = route('admin.avatarPreviews.show', ['style' => 'thumbs', 'seed' => AvatarPreviewSeed]);

    $this->get($url)->assertRedirect(route('login'));

    $this->actingAs(User::factory()->create())->get($url)->assertForbidden();
});

it('answers 404 for a style name with path characters or an unknown style', function (string $style) {
    $this->actingAs(User::factory()->instanceAdmin()->create());

    $this->get("/admin/avatar-previews/{$style}/".AvatarPreviewSeed.'.svg')->assertNotFound();
})->with([
    'parent directory' => ['..'],
    'encoded traversal' => ['..%2F..%2F..%2Fcomposer'],
    'encoded dots' => ['%2e%2e'],
    'nested path' => ['thumbs/../rings'],
    'dotted name' => ['thumbs.json'],
    'upper case' => ['Thumbs'],
    'unknown style' => ['no-such-style'],
    'style without licence data' => ['blobs'],
]);

it('answers 404 for a seed that is not 32 hex characters', function () {
    $this->actingAs(User::factory()->instanceAdmin()->create());

    $this->get('/admin/avatar-previews/thumbs/not-a-seed.svg')->assertNotFound();
});

it('lists the styles on disk with their licence and marks those that need attribution', function () {
    $catalogue = resolve(AvatarStyleCatalogue::class);
    $styles = collect($catalogue->styles())->keyBy('value');

    expect($catalogue->values())->toContain('thumbs', 'notionists', 'fun-emoji', 'initials')
        ->and($styles['notionists'])->toBe([
            'value' => 'notionists',
            'name' => 'Notionists',
            'license' => 'CC0 1.0',
            'attribution' => 'Notionists by Zoish, CC0 1.0',
            'attributionRequired' => false,
        ])
        ->and($styles['fun-emoji'])->toBe([
            'value' => 'fun-emoji',
            'name' => 'Fun Emoji',
            'license' => 'CC BY 4.0',
            'attribution' => 'Fun Emoji Set by Davis Uche, CC BY 4.0',
            'attributionRequired' => true,
        ])
        ->and($styles->has('blobs'))->toBeFalse()
        ->and($catalogue->values())->toContain('blobs')
        ->and($catalogue->has('../../composer'))->toBeFalse()
        ->and($catalogue->path('../../composer'))->toBeNull();
});
