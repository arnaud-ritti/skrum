<?php

namespace App\Concerns;

use App\Support\Database\SearchText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Keeps a folded copy of the columns a model is searched by, and searches it. The copy is written
 * when the text changes, and when it is missing (a row written without the model). The match is
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
                $text = $model->getAttribute($column);
                $isMissing = $text !== null && $model->getAttribute($folded) === null;

                if (! $model->isDirty($column) && ! $isMissing) {
                    continue;
                }

                $model->setAttribute($folded, SearchText::fold($text));
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
