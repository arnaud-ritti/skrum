<?php

namespace App\Enums;

enum IntegrationCapability: string
{
    case ShareLink = 'share_link';
    case ShareRecap = 'share_recap';
    case PokerImport = 'poker_import';
    case EstimateWriteBack = 'estimate_write_back';
    case ActionItemExport = 'action_item_export';
    case AssigneeMapping = 'assignee_mapping';
    case PriorityMapping = 'priority_mapping';
    case StatusSync = 'status_sync';
    case AutomaticEvents = 'automatic_events';
}
