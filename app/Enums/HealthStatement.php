<?php

namespace App\Enums;

enum HealthStatement: string
{
    case Interaction = 'interaction';
    case TaskClarity = 'task_clarity';
    case ManagerSupport = 'manager_support';
    case Vision = 'vision';
    case Processes = 'processes';
    case Motivation = 'motivation';

    public function text(): string
    {
        return match ($this) {
            self::Interaction => __('Interaction with colleagues was productive'),
            self::TaskClarity => __('Tasks assigned to me were clear'),
            self::ManagerSupport => __('My manager was understanding and supportive'),
            self::Vision => __('The vision and goals are clear to me'),
            self::Processes => __('Our processes let me work without blockers'),
            self::Motivation => __('I felt motivated in my work'),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Interaction => __('Interaction'),
            self::TaskClarity => __('Clear tasks'),
            self::ManagerSupport => __('Manager support'),
            self::Vision => __('Vision'),
            self::Processes => __('Processes'),
            self::Motivation => __('Motivation'),
        };
    }
}
