<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Enums\RetroTemplate;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateRetro
{
    public function handle(Team $team, User $creator, string $title, RetroTemplate $template): Retro
    {
        return DB::transaction(function () use ($team, $creator, $title, $template): Retro {
            $retro = $team->retros()->create([
                'title' => $title,
                'template' => $template,
                'phase' => RetroPhase::Writing,
                'guest_token' => Str::random(40),
            ]);

            foreach ($template->columns() as $position => $column) {
                $retro->columns()->create([
                    'title' => __($column['title']),
                    'color' => $column['color'],
                    'position' => $position,
                ]);
            }

            $facilitator = $retro->participants()->create(['user_id' => $creator->id]);

            $retro->update(['facilitator_participant_id' => $facilitator->id]);

            return $retro->fresh(['columns', 'facilitator']);
        });
    }
}
