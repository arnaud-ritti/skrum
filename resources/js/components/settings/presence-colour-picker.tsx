import type { ReactElement } from 'react';
import { PresenceSwatches } from '@/components/skrum/presence-swatches';
import type { AvatarPresence } from '@/components/ui/avatar';
import { useTrans } from '@/hooks/use-trans';

type PresenceColourPickerProps = {
    value: number;
    onChange: (presence: AvatarPresence) => void;
};

/** The twelve presence colours of the profile, sent with the card's Save as `presence_color`. */
export function PresenceColourPicker({
    value,
    onChange,
}: PresenceColourPickerProps): ReactElement {
    const { t } = useTrans();

    return (
        <div
            data-slot="presence-colour-picker"
            className="flex min-w-0 flex-col gap-2"
        >
            <span aria-hidden className="text-sm font-medium">
                {t('Avatar & presence colour')}
            </span>
            <PresenceSwatches
                value={value}
                onChange={onChange}
                name="presence_color"
                label={t('Avatar & presence colour')}
            />
            <span className="text-xs text-muted-foreground">
                {t('Used for your avatar and your live cursor.')}
            </span>
        </div>
    );
}
