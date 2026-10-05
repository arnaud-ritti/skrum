import { MousePointer2, MousePointerBan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTrans } from '@/hooks/use-trans';

export const HideMyCursorKey = 'skrum.hideMyCursor';

export function useHideMyCursor(): [boolean, (hidden: boolean) => void] {
    return useLocalPreference(HideMyCursorKey, false);
}

/** One name, "Hide my cursor", pressed while the cursor is hidden. */
export function CursorToggle({
    hidden,
    onChange,
}: {
    hidden: boolean;
    onChange: (hidden: boolean) => void;
}) {
    const { t } = useTrans();

    return (
        <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-pressed={hidden}
            aria-label={t('Hide my cursor')}
            onClick={() => onChange(!hidden)}
        >
            {hidden ? (
                <MousePointerBan aria-hidden />
            ) : (
                <MousePointer2 aria-hidden />
            )}
        </Button>
    );
}
