<?php

namespace App\Actions\Retros;

use App\Models\Column;
use App\Models\Retro;

class PresentColumns
{
    /**
     * @return array<int, array{
     *     id: string,
     *     title: string,
     *     description: ?string,
     *     color: string,
     *     position: int
     * }>
     */
    public function handle(Retro $retro): array
    {
        return $retro->columns()->get()->map(fn (Column $column): array => [
            'id' => $column->id,
            'title' => $column->title,
            'description' => $column->description,
            'color' => $column->color->value,
            'position' => $column->position,
        ])->values()->all();
    }
}
