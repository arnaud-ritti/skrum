{!! __(':inviter invited you to join the :workspace workspace', ['inviter' => $inviterName, 'workspace' => $workspaceName]) !!}

@if($teamsCount !== null && $membersCount !== null)
{!! $workspaceName !!}: {!! trans_choice('{1} :count team|[2,*] :count teams', $teamsCount) !!} · {!! trans_choice('{1} :count member|[2,*] :count members', $membersCount) !!}

@endif
{!! __(':workspace runs its retros, planning poker and icebreakers on :app.', ['workspace' => $workspaceName, 'app' => $brand->name()]) !!} {!! $joinSentence !!}

{!! __('Accept invitation') !!}: {!! $url !!}

{!! __("The invitation is valid for :days days. Don't know :inviter? Just ignore this email.", ['days' => $validDays, 'inviter' => $inviterFirstName]) !!}

{!! $brand->name() !!} · {!! $brand->host() !!}
