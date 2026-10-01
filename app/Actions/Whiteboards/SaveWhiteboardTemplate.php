<?php

namespace App\Actions\Whiteboards;

use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * @phpstan-import-type SceneFile from CopyWhiteboardScene
 */
class SaveWhiteboardTemplate
{
    public function __construct(
        private ReadWhiteboardScene $readWhiteboardScene,
        private PresentWhiteboardPreview $presentWhiteboardPreview,
    ) {}

    public function handle(Whiteboard $board, User $user, string $name, ?string $description): WhiteboardTemplate
    {
        return DB::transaction(function () use ($board, $user, $name, $description): WhiteboardTemplate {
            $locked = Whiteboard::query()->whereKey($board->id)->lockForUpdate()->firstOrFail();

            WhiteboardGuard::notPrivateWriting($locked);

            $workspace = Workspace::query()->whereKey($locked->team->workspace_id)->lockForUpdate()->firstOrFail();

            WhiteboardTemplateRules::ensureRoom($workspace);
            WhiteboardTemplateRules::ensureNameIsFree($workspace, $name);

            $scene = $this->readWhiteboardScene->handle($locked);

            $template = $workspace->whiteboardTemplates()->make([
                'name' => $name,
                'description' => $description,
                'created_by_user_id' => $user->id,
            ]);

            $template->id = $template->newUniqueId();

            $files = $this->copyFiles($template, $scene['files']);
            $elements = $this->withoutImagesLeftOut($scene['elements'], $files);

            $template->preview = $this->presentWhiteboardPreview->handle($elements);
            $template->scene = ['elements' => $elements, 'files' => $files];
            $template->save();

            return $template;
        });
    }

    /**
     * @param  list<array<string, mixed>>  $elements
     * @param  list<SceneFile>  $files
     * @return list<array<string, mixed>>
     */
    private function withoutImagesLeftOut(array $elements, array $files): array
    {
        $copiedFileIds = array_column($files, 'fileId');

        return array_values(array_filter(
            $elements,
            fn (array $element): bool => ($element['type'] ?? null) !== 'image' || in_array($element['fileId'] ?? null, $copiedFileIds, true),
        ));
    }

    /**
     * The template owns its images: the board may be changed or deleted.
     * An image that cannot be copied is not listed, and the element that
     * shows it is left out of the template (spec §10).
     *
     * @param  list<SceneFile>  $files
     * @return list<SceneFile>
     */
    private function copyFiles(WhiteboardTemplate $template, array $files): array
    {
        $copies = [];

        foreach ($files as $file) {
            if (! Storage::exists($file['path'])) {
                continue;
            }

            $path = "{$template->storageDirectory()}/{$file['fileId']}";

            if (! Storage::copy($file['path'], $path)) {
                continue;
            }

            $copies[] = [...$file, 'path' => $path];
        }

        return $copies;
    }
}
