<?php

namespace App\Enums;

/**
 * Why an exported issue has no assignee or the provider's default
 * priority (spec §7.3). Warnings never block an export.
 */
enum ExportWarningCode: string
{
    case GuestAssignee = 'guestAssignee';
    case NotMapped = 'notMapped';
    case NeverAssign = 'neverAssign';
    case AssigneeRejected = 'assigneeRejected';
    case AssigneeUnavailable = 'assigneeUnavailable';
    case PriorityUnavailable = 'priorityUnavailable';

    public function message(IntegrationProvider $provider, ?string $name = null, ?string $priority = null): ?string
    {
        if ($this === self::NeverAssign) {
            return null;
        }

        $label = $provider->label();

        return match ($this) {
            self::GuestAssignee => __('Guests have no :provider account, so the issue is unassigned.', ['provider' => $label]),
            self::NotMapped => __(':name has no :provider account mapped, so the issue is unassigned.', ['name' => (string) $name, 'provider' => $label]),
            self::AssigneeRejected => __(':provider refused :name as assignee for this project, so the issue is unassigned.', ['name' => (string) $name, 'provider' => $label]),
            self::AssigneeUnavailable => __("This Jira project doesn't accept an assignee on creation."),
            self::PriorityUnavailable => __("Priority :priority isn't available in this project; :provider's default was used.", ['priority' => (string) $priority, 'provider' => $label]),
        };
    }
}
