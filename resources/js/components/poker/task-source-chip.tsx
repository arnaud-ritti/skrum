import { Badge } from '@/components/ui/badge';
import type { PokerTaskExternal } from '@/lib/poker/types';

export function TaskSourceChip({ external }: { external: PokerTaskExternal }) {
    return (
        <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
            {external.key}
        </Badge>
    );
}
