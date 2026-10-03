<?php

namespace App\Enums;

enum TeamActivityKind: string
{
    case RetroStarted = 'retro_started';
    case RetroCompleted = 'retro_completed';
    case PokerStarted = 'poker_started';
    case PokerEnded = 'poker_ended';
    case WhiteboardCreated = 'whiteboard_created';
    case SurveyPublished = 'survey_published';
    case SurveyClosed = 'survey_closed';
    case ActionItemCompleted = 'action_item_completed';
    case MemberJoined = 'member_joined';
}
