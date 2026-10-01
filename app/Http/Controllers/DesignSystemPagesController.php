<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;
use Inertia\Inertia;
use Inertia\Response;

class DesignSystemPagesController extends Controller
{
    private const string SectionName = '/\A[a-z0-9-]+\z/';

    public function index(): Response
    {
        $this->abortOutsideDevelopment();

        return Inertia::render('dev/design-system', [
            'section' => null,
            'sections' => $this->sections(),
        ]);
    }

    public function show(string $section): Response
    {
        $this->abortOutsideDevelopment();

        abort_unless(preg_match(self::SectionName, $section) === 1, 404);
        abort_unless(is_file(resource_path("js/pages/dev/sections/{$section}.tsx")), 404);

        return Inertia::render('dev/design-system', [
            'section' => $section,
        ]);
    }

    private function abortOutsideDevelopment(): void
    {
        abort_unless(app()->environment(['local', 'testing']), 404);
    }

    /**
     * A section file may export its own group, which the page prefers. This
     * is the naming rule for the others: named like a `components/ui` file
     * means "ui", anything else "skrum".
     *
     * @return array<int, array{
     *     name: string,
     *     group: string
     * }>
     */
    private function sections(): array
    {
        return collect(File::glob(resource_path('js/pages/dev/sections/*.tsx')))
            ->map(fn (string $path): string => basename($path, '.tsx'))
            ->filter(fn (string $name): bool => preg_match(self::SectionName, $name) === 1)
            ->sort()
            ->values()
            ->map(fn (string $name): array => [
                'name' => $name,
                'group' => is_file(resource_path("js/components/ui/{$name}.tsx")) ? 'ui' : 'skrum',
            ])
            ->all();
    }
}
