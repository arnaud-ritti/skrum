@if($teamName === null)
{!! __(':inviter invited you to join the :workspace workspace', ['inviter' => $inviterName, 'workspace' => $workspaceName]) !!}
@else
{!! __(':inviter invited you to join the :team team in the :workspace workspace', ['inviter' => $inviterName, 'team' => $teamName, 'workspace' => $workspaceName]) !!}
@endif

@if($teamName !== null)
{!! $teamName !!}: {!! __(':workspace workspace', ['workspace' => $workspaceName]) !!} · {!! trans_choice('{1} :count member|[2,*] :count members', $teamMembersCount ?? 0) !!}

@elseif($teamsCount !== null && $membersCount !== null)
{!! $workspaceName !!}: {!! trans_choice('{1} :count team|[2,*] :count teams', $teamsCount) !!} · {!! trans_choice('{1} :count member|[2,*] :count members', $membersCount) !!}

@endif
{!! __(':workspace runs its retros, planning poker and icebreakers on :app.', ['workspace' => $teamName ?? $workspaceName, 'app' => $brand->name()]) !!} {!! $joinSentence !!}

@if($inviterMessage !== null)
{!! __('“:message”', ['message' => $inviterMessage]) !!}

@endif
{!! __('Accept invitation') !!}: {!! $url !!}

{!! __("The invitation is valid for :days days. Don't know :inviter? Just ignore this email.", ['days' => $validDays, 'inviter' => $inviterFirstName]) !!}

{!! $brand->name() !!} · {!! $brand->host() !!}
