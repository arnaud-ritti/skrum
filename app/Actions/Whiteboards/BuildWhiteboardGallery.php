<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Support\WhiteboardTemplates\BuiltInTemplates;

/**
 * What the "New whiteboard" dialog offers: the built-in templates, then the
 * workspace's own by name. Scenes stay on the server; a tile gets a preview.
 *
 * @phpstan-import-type Preview from PresentWhiteboardPreview
 *
 * @phpstan-type GalleryItem array{
 *     key: string,
 *     workspaceTemplateId: ?string,
 *     name: string,
 *     description: ?string,
 *     preview: Preview
 * }
 */
class BuildWhiteboardGallery
{
    public function __construct(
        private BuiltInTemplates $builtInTemplates,
        private PresentWhiteboardPreview $presentWhiteboardPreview,
    ) {}

    /**
     * @return list<GalleryItem>
     */
    public function handle(Workspace $workspace): array
    {
        $builtIns = array_map(fn (string $key): array => [
            'key' => $key,
            'workspaceTemplateId' => null,
            'name' => $this->builtInTemplates->name($key),
            'description' => $this->builtInTemplates->description($key),
            'preview' => $this->presentWhiteboardPreview->handle($this->builtInTemplates->elements($key)),
        ], BuiltInTemplates::keys());

        $workspaceTemplates = $workspace->whiteboardTemplates()
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'preview'])
            ->map(fn (WhiteboardTemplate $template): array => [
                'key' => "workspace:{$template->id}",
                'workspaceTemplateId' => $template->id,
                'name' => $template->name,
                'description' => $template->description,
                'preview' => $template->preview,
            ])
            ->all();

        return [...$builtIns, ...$workspaceTemplates];
    }
}
