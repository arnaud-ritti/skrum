import { ArrowDown, ArrowUp, Circle } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemPriority } from '@/lib/retro/types';

export const Priorities: ActionItemPriority[] = ['high', 'medium', 'low'];

/** Translation keys, passed to t() through a variable. */
const PriorityLabels: Record<ActionItemPriority, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export function PriorityIcon({ priority }: { priority: ActionItemPriority }) {
    if (priority === 'high') {
        return <ArrowUp className="size-4 text-red-600" aria-hidden="true" />;
    }

    if (priority === 'low') {
        return (
            <ArrowDown className="size-4 text-slate-500" aria-hidden="true" />
        );
    }

    return <Circle className="size-3.5 text-amber-500" aria-hidden="true" />;
}

type Props = {
    value: ActionItemPriority;
    disabled?: boolean;
    onChange: (priority: ActionItemPriority) => void;
};

export function PrioritySelect({ value, disabled, onChange }: Props) {
    const { t } = useTrans();

    return (
        <Select
            value={value}
            disabled={disabled}
            onValueChange={(next) => onChange(next as ActionItemPriority)}
        >
            <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t('Priority')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {Priorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                        <PriorityIcon priority={priority} />
                        {t(PriorityLabels[priority])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
