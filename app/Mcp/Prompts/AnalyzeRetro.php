<?php

namespace App\Mcp\Prompts;

use App\Enums\McpFeature;
use App\Exceptions\Mcp\PromptToolFailed;
use App\Mcp\McpContext;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Prompts\Argument;

class AnalyzeRetro extends SkrumPrompt
{
    protected string $name = 'analyze-retro';

    protected string $description = 'Analyse one retrospective board: its summary, themes, agreements, health check, ROTI and messages.';

    private const string Instructions = <<<'TEXT'
        You are helping a team reflect on a retrospective from skrum. The JSON below holds the board's summary, its themes and suggested actions (when available), its agreements (action items), its health check, its ROTI and its messages (most voted first when votes are visible).
        Identify the key themes, the risks, and what the team should change next time. Check that the agreements cover the top themes, and point to pending suggested actions the user may promote.
        Never guess who wrote an anonymous message.
        TEXT;

    /**
     * @return array<int, Argument>
     */
    public function arguments(): array
    {
        return [new Argument('board_id', 'The id of the retrospective board.', required: true)];
    }

    public function run(Request $request, McpContext $context): Response
    {
        $boardId = $request->validate(['board_id' => ['required', 'uuid']])['board_id'];

        try {
            $context->retro($boardId);

            $data = ['summary' => $this->toolData(GetSummary::class, ['board_id' => $boardId])];

            if (McpFeature::Insights->isAvailable()) {
                $data['insights'] = $this->toolData(ListInsights::class, ['board_id' => $boardId]);
            }

            $data['agreements'] = $this->toolData(ListBoardActionItems::class, ['board_id' => $boardId]);
            $data['health'] = $this->toolData(GetHealth::class, ['board_id' => $boardId]);
            $data['roti'] = $this->toolData(GetRoti::class, ['board_id' => $boardId]);
            [$columns, $sortedByVotes] = $this->messages($boardId);
            $data['messages'] = ['columns' => $columns];
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (PromptToolFailed $failure) {
            return Response::error($failure->getMessage());
        }

        [$data, $dropped] = $this->fit($data, $sortedByVotes);

        $leftOut = $sortedByVotes ? 'lowest-voted messages were' : 'messages were';
        $note = $dropped === 0 ? null : "{$dropped} {$leftOut} left out to fit the size limit.";

        return $this->message(self::Instructions, $data, $note);
    }

    /**
     * All pages of the board's messages, most voted first when the board
     * shows vote totals, otherwise in board order.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: bool}
     */
    private function messages(string $boardId): array
    {
        try {
            return [$this->allPages($boardId, 'votes'), true];
        } catch (PromptToolFailed) {
            return [$this->allPages($boardId, 'position'), false];
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function allPages(string $boardId, string $sort): array
    {
        $columns = [];
        $page = 1;

        do {
            $result = $this->toolData(ListMessages::class, ['board_id' => $boardId, 'sort' => $sort, 'limit' => 200, 'page' => $page]);

            foreach ($result['columns'] ?? [] as $column) {
                $columns[$column['id']] ??= [...$column, 'messages' => []];
                $columns[$column['id']]['messages'] = [...$columns[$column['id']]['messages'], ...$column['messages']];
            }

            $page++;
        } while (($result['hasMore'] ?? false) === true && $page <= 50);

        return array_values($columns);
    }

    /**
     * Drops the lowest-voted top-level messages (with their grouped cards)
     * until the data fits the cap; without vote totals, the last messages of
     * the board order go first.
     *
     * @param  array<string, mixed>  $data
     * @return array{0: array<string, mixed>, 1: int}
     */
    private function fit(array $data, bool $sortedByVotes): array
    {
        $dropped = 0;

        while (self::length($data) > self::MaxContentLength) {
            $candidates = [];

            foreach ($data['messages']['columns'] as $columnIndex => $column) {
                foreach ($column['messages'] as $messageIndex => $message) {
                    $candidates[] = [
                        'column' => $columnIndex,
                        'message' => $messageIndex,
                        'votes' => (int) ($message['votes'] ?? 0),
                        'size' => self::length($message) + 1,
                    ];
                }
            }

            if ($candidates === []) {
                break;
            }

            if ($sortedByVotes) {
                usort($candidates, fn (array $a, array $b): int => $a['votes'] <=> $b['votes']);
            } else {
                $candidates = array_reverse($candidates);
            }

            $excess = self::length($data) - self::MaxContentLength;

            foreach ($candidates as $candidate) {
                unset($data['messages']['columns'][$candidate['column']]['messages'][$candidate['message']]);
                $dropped++;
                $excess -= $candidate['size'];

                if ($excess <= 0) {
                    break;
                }
            }

            foreach ($data['messages']['columns'] as $columnIndex => $column) {
                $data['messages']['columns'][$columnIndex]['messages'] = array_values($column['messages']);
            }
        }

        return [$data, $dropped];
    }
}
