<?php

namespace App\Http\Middleware;

use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RememberCurrentWorkspace
{
    public function handle(Request $request, Closure $next): Response
    {
        $workspace = $request->route('workspace');
        $user = $request->user();

        if (! $workspace instanceof Workspace) {
            return $next($request);
        }

        if ($user->current_workspace_id !== $workspace->id) {
            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        }

        return $next($request);
    }
}
