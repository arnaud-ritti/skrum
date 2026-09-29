<?php

namespace Database\Seeders;

use App\Actions\Retros\CreateRetro;
use App\Actions\Workspaces\CreateWorkspace;
use App\Enums\RetroTemplate;
use App\Enums\WorkspaceRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    private const Password = 'password';

    public function run(CreateWorkspace $createWorkspace, CreateRetro $createRetro): void
    {
        if (User::where('email', 'admin@skrum.test')->exists()) {
            $this->command->info('Demo data already exists, skipping.');

            return;
        }

        $ada = $this->createUser('admin@skrum.test', 'Ada Admin');
        $fran = $this->createUser('facilitator@skrum.test', 'Fran Facilitator');
        $max = $this->createUser('member@skrum.test', 'Max Member');

        $workspace = $createWorkspace->handle($ada, 'Demo Workspace');

        foreach ([$fran, $max] as $member) {
            $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
            $member->update(['current_workspace_id' => $workspace->id]);
        }

        $team = $workspace->teams()->create(['name' => 'Demo Team']);
        $team->members()->attach([$fran->id, $max->id]);

        $retro = $createRetro->handle($team, $fran, 'Demo Retrospective', RetroTemplate::StartStopContinue);
        $retro->update(['guest_access_enabled' => true]);

        $this->command->info('Demo data created.');
        $this->command->table(
            ['Email', 'Password'],
            collect([$ada, $fran, $max])->map(fn (User $user): array => [$user->email, self::Password])->all(),
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

        $user->forceFill(['email_verified_at' => now()])->save();

        return $user;
    }
}
