<?php

namespace App\Mcp\Prompts;

use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Prompts\Argument;

class TeamHealth extends SkrumPrompt
{
    protected string $name = 'team-health';

    protected string $description = "Describe a team's health over its last six completed retrospectives: health score, ROTI, agreements and recurring themes.";

    private const BoardCount = 6;

    private const Instructions = <<<'TEXT'
        You are helping a team understand how it is doing across its last completed retrospectives in skrum. The JSON below lists the boards oldest first with their health check, ROTI, agreements and recurring themes (or most voted messages), then the health and ROTI trends and the team's currently open and overdue agreements.
        Describe the trends, the strongest and weakest health categories, how many agreements get closed, and what keeps repeating. Compare a category only across boards that asked it (match categories by their key) and mention when the statement set changed (sameStatements false). If there is no data, say "health check not run yet".
        TEXT;

    /**
     * @return array<int, Argument>
     */
    public function arguments(): array
    {
        return [new Argument('team_id', 'The id of the team.', required: true)];
    }

    public function run(Request $request, McpContext $context): Response
    {
        $teamId = $request->validate(['team_id' => ['required', 'uuid']])['team_id'];

        try {
            $team = $context->team($teamId);

            $boards = $this->toolData(ListBoards::class, ['team_id' => $teamId, 'finished_only' => true, 'limit' => self::BoardCount])['items'] ?? [];
            $boards = array_reverse($boards);

            $rows = array_map(fn (array $board): array => $this->board($board), $boards);
            $newest = $rows === [] ? null : $rows[array_key_last($rows)];

            $data = [
                'team' => ['id' => $team->id, 'name' => $team->name],
                'boards' => array_map(fn (array $row): array => $row['row'], $rows),
                'healthTrend' => $newest['healthTrend'] ?? [],
                'rotiTrend' => $newest['rotiTrend'] ?? [],
                'openAgreements' => $this->count($teamId, 'open'),
                'overdueAgreements' => $this->count($teamId, 'overdue'),
            ];
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (PromptToolFailed $failure) {
            return Response::error($failure->getMessage());
        }

        [$data, $trimmed] = $this->fit($data);

        $note = $trimmed ? 'The recurring themes of the oldest boards were left out to fit the size limit.' : null;

        return $this->message(self::Instructions, $data, $note);
    }

    /**
     * @param  array<string, mixed>  $board
     * @return array{row: array<string, mixed>, healthTrend: mixed, rotiTrend: mixed}
     */
    private function board(array $board): array
    {
        $health = $this->toolData(GetHealth::class, ['board_id' => $board['id']]);
        $roti = $this->toolData(GetRoti::class, ['board_id' => $board['id']]);
        $agreements = $this->toolData(ListBoardActionItems::class, ['board_id' => $board['id']]);
        $items = $agreements['items'] ?? $agreements;

        $healthTrend = $health['trend'] ?? [];
        $rotiTrend = $roti['trend'] ?? [];
        unset($health['trend'], $roti['trend']);

        return [
            'row' => [
                'board' => ['id' => $board['id'], 'title' => $board['title'], 'completedAt' => $board['completedAt'], 'url' => $board['url']],
                'health' => $health,
                'roti' => $roti,
                'agreements' => [
                    'created' => count($items),
                    'completed' => count(array_filter($items, fn (array $item): bool => ($item['status'] ?? null) === 'completed')),
                ],
                ...$this->recurring($board['id']),
            ],
            'healthTrend' => $healthTrend,
            'rotiTrend' => $rotiTrend,
        ];
    }

    /**
     * Spec 2 themes when insights are available, otherwise the five most
     * voted messages of the board.
     *
     * @return array<string, mixed>
     */
    private function recurring(string $boardId): array
    {
        if (McpFeature::Insights->isAvailable()) {
            $insights = $this->toolData(ListInsights::class, ['board_id' => $boardId]);

            return ['themes' => array_map(fn (array $theme): string => $theme['name'], $insights['themes'] ?? [])];
        }

        try {
            $messages = $this->toolData(ListMessages::class, ['board_id' => $boardId, 'sort' => 'votes', 'limit' => 50]);
        } catch (PromptToolFailed) {
            return ['topMessages' => []];
        }

        $top = [];

        foreach ($messages['columns'] ?? [] as $column) {
            foreach ($column['messages'] as $message) {
                $top[] = ['content' => $message['content'], 'votes' => $message['votes'] ?? 0];
            }
        }

        usort($top, fn (array $a, array $b): int => $b['votes'] <=> $a['votes']);

        $top = array_slice($top, 0, 5);

        return ['topMessages' => $top];
    }

    private function count(string $teamId, string $status): int
    {
        $total = 0;
        $page = 1;

        do {
            $result = $this->toolData(ListActionItems::class, ['team_id' => $teamId, 'status' => $status, 'limit' => 50, 'page' => $page]);
            $total += count($result['items'] ?? []);
            $page++;
        } while (($result['hasMore'] ?? false) === true && $page <= 20);

        return $total;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: array<string, mixed>, 1: bool}
     */
    private function fit(array $data): array
    {
        $trimmed = false;

        foreach (array_keys($data['boards']) as $index) {
            if (self::length($data) <= self::MaxContentLength) {
                break;
            }

            $data['boards'][$index]['themes'] = [];
            $data['boards'][$index]['topMessages'] = [];
            $trimmed = true;
        }

        return [$data, $trimmed];
    }
}
