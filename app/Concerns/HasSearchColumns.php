<?php

namespace App\Concerns;

use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Keeps a folded copy of the columns a model is searched by, and searches it. The match is
 * case-sensitive on purpose: both sides are already lower-case, and a case-sensitive LIKE is the
 * one form that means the same on PostgreSQL, MySQL, MariaDB and SQLite.
 *
 * @mixin Model
 */
trait HasSearchColumns
{
    /**
     * @return array<string, string> searched column => folded column
     */
    abstract public function searchColumns(): array;

    public static function bootHasSearchColumns(): void
    {
        static::saving(function (Model $model): void {
            foreach ($model->searchColumns() as $column => $folded) {
                if ($model->exists && ! $model->isDirty($column)) {
                    continue;
                }

                $model->setAttribute($folded, SearchText::fold($model->getAttribute($column)));
            }
        });
    }

    public function initializeHasSearchColumns(): void
    {
        $this->makeHidden(array_values($this->searchColumns()));
    }

    /**
     * @param  Builder<static>  $query
     */
    public function scopeWhereContains(Builder $query, string $column, string $term): void
    {
        $query->whereLike($query->qualifyColumn($this->searchColumns()[$column]), SearchText::pattern($term), caseSensitive: true);
    }

    /**
     * @param  Builder<static>  $query
     */
    public function scopeOrWhereContains(Builder $query, string $column, string $term): void
    {
        $query->orWhereLike($query->qualifyColumn($this->searchColumns()[$column]), SearchText::pattern($term), caseSensitive: true);
    }
}
