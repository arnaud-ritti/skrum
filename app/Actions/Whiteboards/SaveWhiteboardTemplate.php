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
            $workspace = Workspace::query()->whereKey($locked->team->workspace_id)->lockForUpdate()->firstOrFail();

            WhiteboardTemplateRules::ensureRoom($workspace);
            WhiteboardTemplateRules::ensureNameIsFree($workspace, $name);

            $scene = $this->readWhiteboardScene->handle($locked);

            $template = $workspace->whiteboardTemplates()->make([
                'name' => $name,
                'description' => $description,
                'preview' => $this->presentWhiteboardPreview->handle($scene['elements']),
                'created_by_user_id' => $user->id,
            ]);

            $template->id = $template->newUniqueId();
            $template->scene = ['elements' => $scene['elements'], 'files' => $this->copyFiles($template, $scene['files'])];
            $template->save();

            return $template;
        });
    }

    /**
     * The template owns its images: the board may be changed or deleted.
     * An image that cannot be copied is not listed, so a board created from
     * the template leaves its element out.
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
