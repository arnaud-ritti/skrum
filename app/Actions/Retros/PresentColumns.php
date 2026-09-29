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
     *     color: string,
     *     position: int
     * }>
     */
    public function handle(Retro $retro): array
    {
        return $retro->columns()->get()->map(fn (Column $column) => [
            'id' => $column->id,
            'title' => $column->title,
            'color' => $column->color->value,
            'position' => $column->position,
        ])->values()->all();
    }
}
