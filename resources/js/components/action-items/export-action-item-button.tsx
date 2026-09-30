import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import type { ActionItem } from '@/lib/retro/types';
import type { ExportSource } from '@/types';
import type { RunMutation } from './action-item-card';
import { ExportActionItemDialog } from './export-action-item-dialog';

export type ExportContext = {
    workspace: string;
    sources: ExportSource[];
    canManagePeople: boolean;
};

type Props = {
    item: ActionItem;
    context: ExportContext;
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    onExported: (item: ActionItem) => void;
};

/**
 * One entry per connected tracker the item was not exported to yet: an
 * item is exported at most once per provider (spec §3).
 */
export function ExportActionItemButton({
    item,
    context,
    endpoints,
    run,
    onExported,
}: Props) {
    const { t } = useTrans();
    const [chosen, setChosen] = useState<ExportSource | null>(null);
    const exported = new Set(
        (item.externalLinks ?? []).map((link) => link.source),
    );
    const available = context.sources.filter(
        (source) => !exported.has(source.source),
    );

    if (available.length === 0 && chosen === null) {
        return null;
    }

    return (
        <>
            {available.length === 1 && (
                <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    aria-label={t('Export to :provider', {
                        provider: available[0].label,
                    })}
                    onClick={() => setChosen(available[0])}
                >
                    <Upload className="size-4" />
                </Button>
            )}
            {available.length > 1 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 shrink-0"
                            aria-label={t('Export')}
                        >
                            <Upload className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {available.map((source) => (
                            <DropdownMenuItem
                                key={source.source}
                                onSelect={() => setChosen(source)}
                            >
                                {t('Export to :provider', {
                                    provider: source.label,
                                })}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
            {chosen !== null && (
                <ExportActionItemDialog
                    item={item}
                    source={chosen}
                    workspace={context.workspace}
                    canManagePeople={context.canManagePeople}
                    endpoints={endpoints}
                    run={run}
                    onClose={() => setChosen(null)}
                    onExported={onExported}
                />
            )}
        </>
    );
}
