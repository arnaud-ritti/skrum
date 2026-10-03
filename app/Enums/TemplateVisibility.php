<?php

namespace App\Enums;

enum TemplateVisibility: string
{
    case Personal = 'personal';
    case Team = 'team';
    case Workspace = 'workspace';
}
