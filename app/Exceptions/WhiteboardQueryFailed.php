<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Stands in for a QueryException on statements that carry note text: its
 * message holds neither the statement nor its bindings, and it has no
 * previous exception, so nothing of the scene reaches a log or a failed job.
 */
class WhiteboardQueryFailed extends RuntimeException
{
    public function __construct(public string $boardId, public string $sqlState)
    {
        parent::__construct("A query on whiteboard {$boardId} failed (SQLSTATE {$sqlState}).");
    }
}
