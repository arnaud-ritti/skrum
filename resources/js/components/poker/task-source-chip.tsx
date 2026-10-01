import { CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { TrackerLabels, type PokerTaskExternal } from '@/lib/poker/types';

export function TaskSourceChip({ external }: { external: PokerTaskExternal }) {
    const { t } = useTrans();

    return (
        <Badge
            variant="outline"
            className="shrink-0 gap-1 font-mono text-[11px]"
        >
            {external.statusCategory === 'done' && (
                <CircleCheck
                    className="size-3 text-emerald-600"
                    aria-label={t('Done in :source', {
                        source: TrackerLabels[external.source],
                    })}
                />
            )}
            {external.key}
        </Badge>
    );
}
