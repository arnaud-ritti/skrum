<?php

namespace Database\Seeders;

use App\Actions\Retros\CreateRetro;
use App\Actions\Retros\NewRetro;
use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    private const Password = 'password';

    public function run(CreateWorkspace $createWorkspace, CreateRetro $createRetro): void
    {
        if (! app()->environment('local') && ! config('skrum.demo.enabled')) {
            $this->command->warn('Demo mode is disabled, skipping.');

            return;
        }

        if (User::where('email', 'facilitator@skrum.test')->exists()) {
            $this->command->info('Demo data already exists, skipping.');

            return;
        }

        $ada = null;
        if (! config('skrum.demo.enabled')) {
            $ada = $this->createUser('admin@skrum.test', 'Ada Admin');
            $ada->forceFill(['is_instance_admin' => true])->save();
        }
        $fran = $this->createUser('facilitator@skrum.test', 'Fran Facilitator');
        $max = $this->createUser('member@skrum.test', 'Max Member');

        $workspace = $createWorkspace->handle($ada ?? $fran, 'Demo Workspace');

        foreach ($ada === null ? [$max] : [$fran, $max] as $member) {
            $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
            $member->forceFill(['current_workspace_id' => $workspace->id])->save();
        }

        $team = $workspace->teams()->create(['name' => 'Demo Team']);
        $team->members()->attach([
            $fran->id => ['role' => TeamRole::Facilitator->value],
            $max->id => ['role' => TeamRole::Member->value],
        ]);

        $retro = $createRetro->handle($team, $fran, new NewRetro('Demo Retrospective', 'start_stop_continue'));
        $retro->update(['guest_access_enabled' => true]);

        if (config('skrum.demo.enabled')) {
            foreach ($retro->columns as $position => $column) {
                $retro->cards()->create([
                    'column_id' => $column->id,
                    'participant_id' => $retro->facilitator_participant_id,
                    'content' => ['Try smaller pull requests', 'Stop skipping retrospective actions', 'Keep pairing on difficult tasks'][$position],
                    'position' => 0,
                ]);
            }
        }

        $this->command->info('Demo data created.');
        $this->command->table(
            ['Email', 'Password'],
            collect($ada === null ? [$fran, $max] : [$ada, $fran, $max])->map(fn (User $user): array => [$user->email, self::Password])->all(),
        );
        $this->command->info('Retro: '.route('retros.show', $retro));
        $this->command->info('Guest join: '.route('retros.join.show', $retro->guest_token));
    }

    private function createUser(string $email, string $name): User
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => self::Password,
            'locale' => 'en',
        ]);

        $user->forceFill(['email_verified_at' => now(), 'password_set_at' => now()])->save();

        return $user;
    }
}
