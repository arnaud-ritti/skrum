<?php

namespace App\Actions\Teams;

use App\Actions\Games\IcebreakerGameOptions;
use App\Actions\Integrations\ListPokerSources;
use App\Actions\Retros\BuildTemplateCatalogue;
use App\Actions\Retros\TemplateAvailability;
use App\Actions\Retros\TopTeamTemplates;
use App\Actions\TeamSurveys\PresentTeamSurveySummary;
use App\Actions\Whiteboards\BuildWhiteboardGallery;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Enums\TeamSurveyStatus;
use App\Enums\TemplateCategory;
use App\Enums\TemplateVisibility;
use App\Models\GameRoom;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\Alphabetical;
use App\Support\Games\GameRulesRegistry;
use App\Support\Surveys\SurveyTemplateCatalogue;
use App\Support\Teams\SprintCalendar;
use Inertia\Inertia;

class PresentNewSessionOptions
{
    public function __construct(
        private BuildTemplateCatalogue $buildTemplateCatalogue,
        private IcebreakerGameOptions $icebreakerGameOptions,
        private BuildWhiteboardGallery $buildWhiteboardGallery,
        private TopTeamTemplates $topTeamTemplates,
        private GameRulesRegistry $gameRulesRegistry,
        private SurveyTemplateCatalogue $surveyTemplateCatalogue,
        private PresentTeamSurveySummary $presentTeamSurveySummary,
        private ListPokerSources $listPokerSources,
        private SuggestedFacilitator $suggestedFacilitator,
        private TemplateAvailability $templateAvailability,
    ) {}

    /**
     * The props of the "New session" dialog, shared by the team page and the Sessions page.
     *
     * @return array<string, mixed>
     */
    public function handle(User $viewer, Workspace $workspace, Team $team): array
    {
        $managesWorkspace = $viewer->canManage($workspace);

        return [
            'templateCategories' => TemplateCategory::options(),
            'topTemplates' => $this->topTeamTemplates->handle($team),
            'catalogue' => Inertia::optional(fn (): array => $this->buildTemplateCatalogue->handle($workspace, $viewer, $team)),
            'canSaveTemplate' => $viewer->can('share', [WorkspaceTemplate::class, $workspace, TemplateVisibility::Workspace]),
            'canCreateRetro' => $viewer->can('createRetro', $team),
            'icebreakerGames' => $this->icebreakerGameOptions->options(),
            'gameOptions' => $this->gameRulesRegistry->options(new GameRoom(['team_id' => $team->id])),
            'canCreateGameRoom' => $viewer->can('createGameRoom', $team)
                && $team->gameRooms()->whereNull('retro_id')->count() < GameRoom::MaxRoomsPerTeam,
            'roomLimit' => GameRoom::MaxRoomsPerTeam,
            'pokerDecks' => $this->pokerDecks($viewer, $workspace, $team),
            'defaultPokerDeck' => [
                'deck' => $team->default_poker_deck,
                'savedDeckId' => $team->default_saved_poker_deck_id,
            ],
            'pokerDeckOptions' => PokerDeck::options(),
            'canCreatePokerGame' => $viewer->can('createPokerGame', $team),
            'pokerSources' => $viewer->can('createPokerGame', $team) && IntegrationProvider::anyEnabled()
                ? $this->listPokerSources->handle($team)
                : [],
            'canCreateWhiteboard' => $viewer->can('createWhiteboard', $team),
            'whiteboardGallery' => Inertia::optional(fn (): array => $this->buildWhiteboardGallery->handle($workspace)),
            'surveys' => PresentTeamSurveySummary::withCounts($team->teamSurveys())
                ->whereNull('retro_id')
                ->latest('updated_at')
                ->orderByDesc('id')
                ->get()
                ->map(fn (TeamSurvey $survey): array => $this->presentTeamSurveySummary->handle($survey, $viewer, $managesWorkspace))
                ->reject(fn (array $survey): bool => $survey['status'] === TeamSurveyStatus::Draft->value && ! $survey['canManage'])
                ->values(),
            'canCreateSurvey' => $viewer->can('createSurvey', $team),
            'surveyTemplates' => $this->surveyTemplateCatalogue->options($team),
            'currentSprintNumber' => SprintCalendar::forTeam($team, now())->numberOn(now()),
            'retroFacilitators' => Alphabetical::sort(
                $team->participatingMembers()->orderBy('users.id')->get(),
                fn (User $member): string => $member->name,
            )->map(fn (User $member): array => [...$member->only(['id', 'name']), 'avatarUrl' => $member->avatarUrl()])->values()->all(),
            'suggestedFacilitatorId' => $this->suggestedFacilitator->for($team)?->id,
            'facilitatorRotation' => $team->facilitator_rotation_enabled,
            'defaultRetroTemplate' => $this->defaultRetroTemplate($team, $viewer),
        ];
    }

    private function defaultRetroTemplate(Team $team, User $viewer): ?string
    {
        $key = $team->default_retro_template;

        if ($key === null || ! $this->templateAvailability->isAvailable($team, $viewer, $key)) {
            return null;
        }

        return $key;
    }

    /**
     * @return array<int, array{id: string, name: string, cards: array<int, string>, scope: string, canManage: bool}>
     */
    private function pokerDecks(User $viewer, Workspace $workspace, Team $team): array
    {
        $isManager = $viewer->canManage($workspace);

        return Alphabetical::sort($team->availablePokerDecks()->orderBy('id')->get(), fn (SavedPokerDeck $deck): string => $deck->name)
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'scope' => $deck->isWorkspaceDeck() ? 'workspace' : 'team',
                'canManage' => $isManager || (! $deck->isWorkspaceDeck() && $deck->created_by_user_id === $viewer->id),
            ])
            ->values()
            ->all();
    }
}
