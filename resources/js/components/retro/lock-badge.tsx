import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from './board-context';

export function LockBadge() {
    const { board } = useBoard();
    const { t } = useTrans();

    if (!board.retro.isLocked) {
        return null;
    }

    return (
        <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" aria-hidden="true" />
            {t('Board closed for editing')}
        </Badge>
    );
}
