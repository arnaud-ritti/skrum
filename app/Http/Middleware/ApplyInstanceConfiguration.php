<?php

namespace App\Http\Middleware;

use App\Support\InstanceConfiguration\InstanceConfiguration;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApplyInstanceConfiguration
{
    public function __construct(private InstanceConfiguration $instanceConfiguration) {}

    public function handle(Request $request, Closure $next): Response
    {
        rescue(fn () => $this->instanceConfiguration->apply(), report: false);

        return $next($request);
    }
}
