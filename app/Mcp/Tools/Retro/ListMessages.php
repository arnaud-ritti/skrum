<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\Presenters\McpMessage;
use App\Mcp\Tools\SkrumTool;
use App\Models\Card;
use App\Models\Column;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Rule;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListMessages extends SkrumTool
{
    private const MaxLimit = 200;

    protected string $name = 'retro.board.messages.list';

    protected string $description = 'List the messages (cards) of a board grouped by template column, with grouped cards under their lead card. While participants are still writing, other people\'s messages are hidden. Authors are never shown on anonymous boards (except your own). Vote totals appear only when the board shows them.';

    public function __construct(
        private McpContext $context,
        private McpMessage $presentMessage,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
            'column_id' => $schema->string()->description('Only this column (UUID).'),
            'sort' => $schema->string()->enum(['position', 'votes'])->default('position'),
            'limit' => $schema->integer()->min(1)->max(self::MaxLimit)->default(self::DefaultLimit),
            'page' => $schema->integer()->min(1)->default(1),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'board_id' => ['required', 'uuid'],
            'column_id' => ['nullable', 'uuid'],
            'sort' => ['nullable', Rule::in(['position', 'votes'])],
            ...$this->paginationRules(self::MaxLimit),
        ]);

        $retro = $this->context->retro($validated['board_id']);
        $sortsByVotes = ($validated['sort'] ?? 'position') === 'votes';

        if ($sortsByVotes && ! $retro->showsVoteTotals()) {
            abort(422, __('Vote totals are not visible yet.'));
        }

        $columns = $retro->columns()
            ->when($validated['column_id'] ?? null, fn (Builder $query, string $columnId) => $query->whereKey($columnId))
            ->get();

        if (($validated['column_id'] ?? null) !== null && $columns->isEmpty()) {
            abort(404);
        }

        $viewer = $this->context->participant($retro);
        $voteTotals = $this->presentMessage->voteTotals($retro);

        $query = Card::query()
            ->where('cards.retro_id', $retro->id)
            ->whereNull('parent_card_id')
            ->whereIn('column_id', $columns->pluck('id'))
            ->with(McpMessage::eagerLoads())
            ->select('cards.*')
            ->join('columns', 'columns.id', '=', 'cards.column_id');

        $sortsByVotes
            ? $query->withCount('votes')->orderByDesc('votes_count')->orderBy('columns.position')->orderBy('cards.position')
            : $query->orderBy('columns.position')->orderBy('cards.position');

        [$pageNumber, $limit] = $this->pagination($validated, self::MaxLimit);
        $page = $this->paginate($query->orderBy('cards.id'), $pageNumber, $limit, fn (Card $card) => $card);
        $cardsByColumn = collect($page['items'])->groupBy('column_id');

        return Response::structured([
            'columns' => $columns->map(fn (Column $column) => [
                'id' => $column->id,
                'title' => $column->title,
                'description' => $column->description,
                'messages' => $cardsByColumn->get($column->id, collect())
                    ->map(fn (Card $card) => $this->presentMessage->handle($card, $retro, $viewer, $voteTotals))
                    ->values()
                    ->all(),
            ])->values()->all(),
            'page' => $page['page'],
            'hasMore' => $page['hasMore'],
        ]);
    }
}
