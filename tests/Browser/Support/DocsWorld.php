<?php

namespace Tests\Browser\Support;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Collection;
use InvalidArgumentException;

class DocsWorld
{
    /** @var array<int, array{0: string, 1: WorkspaceRole, 2: TeamRole}> */
    private const array Cast = [
        ['Camille Roux', WorkspaceRole::Admin, TeamRole::Owner],
        ['Théo Martin', WorkspaceRole::Member, TeamRole::Facilitator],
        ['Inès Benali', WorkspaceRole::Member, TeamRole::Member],
        ['Malik Kone', WorkspaceRole::Member, TeamRole::Member],
        ['Sofia Lindqvist', WorkspaceRole::Member, TeamRole::Member],
        ['Noa Kim', WorkspaceRole::Member, TeamRole::Member],
        ['Lucas Durand', WorkspaceRole::Member, TeamRole::Member],
        ['Yuki Tanaka', WorkspaceRole::Member, TeamRole::Observer],
    ];

    /**
     * @param  Collection<string, User>  $people
     */
    public function __construct(
        public Workspace $workspace,
        public Team $team,
        public Collection $people,
    ) {}

    public static function create(): self
    {
        config(['app.name' => 'Skrum']);

        $workspace = Workspace::factory()->create(['name' => 'Nordlys', 'slug' => 'nordlys']);
        $team = Team::factory()->for($workspace)->create(['name' => 'Atlas', 'slug' => 'atlas']);
        $people = collect();

        foreach (self::Cast as $index => [$name, $workspaceRole, $teamRole]) {
            $firstName = str($name)->before(' ')->toString();

            $person = User::factory()->create([
                'id' => sprintf('0199d0c5-0000-7000-8000-%012d', $index + 1),
                'name' => $name,
                'email' => str($firstName)->ascii()->lower()->append('@nordlys.example')->toString(),
            ]);

            $workspace->members()->attach($person, ['role' => $workspaceRole->value]);
            $team->members()->attach($person, ['role' => $teamRole->value]);

            $people->put($firstName, $person);
        }

        teamSprint($team, 41, now()->subDays(32)->toDateString(), now()->subDays(19)->toDateString());
        teamSprint($team, 42, now()->subDays(18)->toDateString(), now()->subDays(5)->toDateString());
        teamSprint($team, 43, now()->subDays(4)->toDateString(), now()->addDays(9)->toDateString());

        return new self($workspace, $team, $people);
    }

    public function person(string $firstName): User
    {
        return $this->people->get($firstName) ?? throw new InvalidArgumentException("Nobody in the story is called {$firstName}.");
    }
}
