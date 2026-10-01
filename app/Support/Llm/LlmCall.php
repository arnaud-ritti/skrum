<?php

namespace App\Support\Llm;

use App\Exceptions\Llm\LlmUnavailable;
use Closure;

class LlmCall
{
    /**
     * @template TReturn
     *
     * @param  Closure(): TReturn  $call
     * @return TReturn
     */
    public static function run(Closure $call): mixed
    {
        try {
            return $call();
        } catch (LlmUnavailable) {
            abort(502, __('The text generator is unavailable. Try again later.'));
        }
    }
}
