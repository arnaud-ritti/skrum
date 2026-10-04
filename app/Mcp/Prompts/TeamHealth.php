<?php

namespace App\Mcp\Prompts;

use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\HealthCheck\BuildHealthTrend;
use App\Enums\McpFeature;
use App\Enums\RetroPhase;
use App\Exceptions\Mcp\PromptToolFailed;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Prompts\Argument;

class TeamHealth extends SkrumPrompt
{
    protected string $name = 'team-health';

    protected string $description = "Describe a team's health: the scores of its last six closed health checks, run in a retro or on their own, and the ROTI, agreements and recurring themes of its last six completed retrospectives.";

    private const int BoardCount = 6;

    private const string Instructions = <<<'TEXT'
        You are helping a team understand how it is doing in skrum. The JSON below lists its last six completed retrospectives oldest first with their health check (when one was run in the retro), ROTI, agreements and recurring themes (or most voted messages); then the health trend, which covers the team's last six closed health checks whether run in a retro or on their own; then the ROTI trend and the team's currently open and overdue agreements. Health scores are on a scale of 1 to 5; boards of before the change to that scale were answered on 1 to 10 and are read halved.
        Describe the trends, the strongest and weakest health categories, how many agreements get closed, and what keeps repeating. Compare a category only across boards that asked it (match categories by their key) and mention when the statement set changed (sameStatements false). If there is no data, say "health check not run yet".
        TEXT;

    public function __construct(
        private McpBoard $presentBoard,
        private BuildHealthTrend $buildHealthTrend,
        private ActionItemQuery $actionItemQuery,
    ) {}

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

            $boards = $this->lastCompletedBoards($team);

            $rows = array_map($this->board(...), $boards);

            $data = [
                'team' => ['id' => $team->id, 'name' => $team->name],
                'boards' => array_map(fn (array $row): array => $row['row'], $rows),
                'healthTrend' => GetHealth::presentTrend($this->buildHealthTrend->forTeam($team->id)),
                'rotiTrend' => $this->newestRotiTrend($rows),
                'openAgreements' => $this->count($team, 'open'),
                'overdueAgreements' => $this->count($team, 'overdue'),
            ];
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (PromptToolFailed $failure) {
            return Response::error($failure->getMessage());
        }

        [$data, $trimmedThemes, $droppedBoards] = $this->fit($data);

        $notes = array_filter([
            $trimmedThemes ? "Older boards' recurring topics were left out to fit the size limit." : null,
            $droppedBoards > 0 ? "{$droppedBoards} oldest boards were left out to fit the size limit." : null,
        ]);
        $note = $notes === [] ? null : implode("\n", $notes);

        return $this->message(self::Instructions, $data, $note);
    }

    /**
     * Oldest first.
     *
     * @return array<int, array<string, mixed>>
     */
    private function lastCompletedBoards(Team $team): array
    {
        $boards = McpBoard::withCounts(Retro::query())
            ->where('team_id', $team->id)
            ->where('phase', RetroPhase::Completed)
            ->whereNotNull('completed_at')
            ->latest('completed_at')
            ->orderByDesc('id')
            ->limit(self::BoardCount)
            ->get();

        return $boards
            ->reverse()
            ->map(fn (Retro $retro): array => $this->presentBoard->handle($retro))
            ->values()
            ->all();
    }

    /**
     * The trend of the newest board that has a ROTI: a newer board without
     * one returns no trend at all.
     *
     * @param  array<int, array{row: array<string, mixed>, rotiTrend: mixed}>  $rows
     */
    private function newestRotiTrend(array $rows): mixed
    {
        foreach (array_reverse($rows) as $row) {
            if ($row['rotiTrend'] !== []) {
                return $row['rotiTrend'];
            }
        }

        return [];
    }

    /**
     * @param  array<string, mixed>  $board
     * @return array{row: array<string, mixed>, rotiTrend: mixed}
     */
    private function board(array $board): array
    {
        $health = $this->toolData(GetHealth::class, ['board_id' => $board['id']]);
        $roti = $this->toolData(GetRoti::class, ['board_id' => $board['id']]);
        $agreements = $this->toolData(ListBoardActionItems::class, ['board_id' => $board['id']]);
        $items = $agreements['items'] ?? [];

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

    /**
     * The count retro.actions.list would page through, in one query.
     */
    private function count(Team $team, string $status): int
    {
        return $this->actionItemQuery
            ->filter(ActionItem::query()->where('team_id', $team->id), McpGrant::current()->user, ActionItemFilters::forStatus($status))
            ->count();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: array<string, mixed>, 1: bool, 2: int}
     */
    private function fit(array $data): array
    {
        $trimmedThemes = false;

        foreach (array_keys($data['boards']) as $index) {
            if (self::length($data) <= self::MaxContentLength) {
                break;
            }

            $key = array_key_exists('themes', $data['boards'][$index]) ? 'themes' : 'topMessages';
            $data['boards'][$index][$key] = [];
            $trimmedThemes = true;
        }

        $droppedBoards = 0;

        while (self::length($data) > self::MaxContentLength && $data['boards'] !== []) {
            array_shift($data['boards']);
            $droppedBoards++;
        }

        return [$data, $trimmedThemes, $droppedBoards];
    }
}
