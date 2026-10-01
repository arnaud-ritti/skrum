import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import {
    SessionTypePicker,
    useDefaultSessionTypeOptions,
} from '@/components/skrum/session-type-picker';
import type { SessionType } from '@/components/skrum/session-type-picker';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function SessionTypePickerSection() {
    const { t } = useTrans();
    const defaults = useDefaultSessionTypeOptions();
    const [tiles, setTiles] = useState<SessionType>('retro');
    const [withHelp, setWithHelp] = useState<SessionType>('survey');
    const [disabled, setDisabled] = useState<SessionType>('poker');
    const [compact, setCompact] = useState<SessionType>('whiteboard');
    const [compactDisabled, setCompactDisabled] =
        useState<SessionType>('retro');
    const [menu, setMenu] = useState<SessionType>('retro');

    const withDisabledIcebreaker = defaults.map((option) =>
        option.value === 'icebreaker'
            ? { ...option, disabledReason: t('Disabled by the admin') }
            : option,
    );

    return (
        <div className="flex max-w-240 flex-col gap-6 p-6">
            <State label={t('Tiles: default and selected')}>
                <SessionTypePicker
                    label={t('Session type')}
                    value={tiles}
                    onValueChange={setTiles}
                />
            </State>
            <State label={t('Tiles with help text')}>
                <SessionTypePicker
                    label={t('Session type')}
                    help={t('The rest of the form depends on the type.')}
                    value={withHelp}
                    onValueChange={setWithHelp}
                />
            </State>
            <State label={t('Tiles: one type disabled with its reason')}>
                <SessionTypePicker
                    label={t('Session type')}
                    value={disabled}
                    onValueChange={setDisabled}
                    options={withDisabledIcebreaker}
                />
            </State>
            <State label={t('Compact list (Drawer)')}>
                <div className="max-w-88">
                    <SessionTypePicker
                        variant="compact"
                        label={t('Session type')}
                        value={compact}
                        onValueChange={setCompact}
                    />
                </div>
            </State>
            <State label={t('Compact list: one type disabled')}>
                <div className="max-w-88">
                    <SessionTypePicker
                        variant="compact"
                        label={t('Session type')}
                        value={compactDisabled}
                        onValueChange={setCompactDisabled}
                        options={withDisabledIcebreaker}
                    />
                </div>
            </State>
            <State label={t('Compact in a dropdown menu')}>
                <div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                {t('New session')}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-88 max-w-full">
                            <SessionTypePicker
                                as="menu"
                                variant="compact"
                                value={menu}
                                onValueChange={setMenu}
                                options={withDisabledIcebreaker}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </State>
        </div>
    );
}
