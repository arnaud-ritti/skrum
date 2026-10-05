import type { ActionItemSelection } from '@/components/action-items/use-action-item-selection';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItem } from '@/lib/retro/types';

/** The box of a row; disabled on a row the viewer may neither complete nor manage. */
export function ActionItemSelectCell({
    item,
    selection,
    className,
}: {
    item: ActionItem;
    selection: ActionItemSelection;
    /** The box's size: the list draws a larger one for a finger. */
    className?: string;
}) {
    const { t } = useTrans();
    const name = t('Select :title', { title: item.content });

    if (!selection.selectable(item)) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        tabIndex={0}
                        role="checkbox"
                        aria-checked={false}
                        aria-disabled
                        aria-label={name}
                        data-slot="action-row-select-locked"
                        className="inline-flex rounded-xs outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <Checkbox
                            aria-hidden
                            checked={false}
                            disabled
                            className={className}
                        />
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    {t('You cannot change this action item')}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Checkbox
            aria-label={name}
            data-slot="action-row-select"
            className={className}
            checked={selection.isSelected(item.id)}
            onCheckedChange={() => selection.toggle(item.id)}
        />
    );
}

/** The box of the table's header: every selectable row of the page. */
export function ActionItemSelectHead({
    items,
    selection,
}: {
    items: ActionItem[];
    selection: ActionItemSelection;
}) {
    const { t } = useTrans();
    const ids = items.filter(selection.selectable).map((item) => item.id);
    const state = selection.head(ids);

    return (
        <Checkbox
            data-slot="action-select-all"
            aria-label={
                state === true
                    ? t('Clear selection')
                    : t('Select all on this page')
            }
            checked={state}
            disabled={ids.length === 0}
            onCheckedChange={(checked) => {
                if (checked === true) {
                    selection.setMany(ids, true);

                    return;
                }

                selection.clear();
            }}
        />
    );
}

/** The box of a group row: the selectable rows of that group. */
export function ActionItemSelectGroup({
    label,
    items,
    selection,
}: {
    label: string;
    items: ActionItem[];
    selection: ActionItemSelection;
}) {
    const { t } = useTrans();
    const ids = items.filter(selection.selectable).map((item) => item.id);

    return (
        <Checkbox
            data-slot="action-group-select"
            aria-label={t('Select :title', { title: label })}
            checked={selection.head(ids)}
            disabled={ids.length === 0}
            onCheckedChange={(checked) =>
                selection.setMany(ids, checked === true)
            }
        />
    );
}
