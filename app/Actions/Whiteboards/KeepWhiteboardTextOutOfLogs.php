<?php

namespace App\Actions\Whiteboards;

use App\Exceptions\WhiteboardQueryFailed;
use Closure;
use Illuminate\Database\QueryException;

class KeepWhiteboardTextOutOfLogs
{
    /**
     * @template TResult
     *
     * @param  Closure(): TResult  $work
     * @return TResult
     */
    public function handle(string $boardId, Closure $work): mixed
    {
        try {
            return $work();
        } catch (QueryException $exception) {
            throw new WhiteboardQueryFailed($boardId, (string) $exception->getCode());
        }
    }
}
