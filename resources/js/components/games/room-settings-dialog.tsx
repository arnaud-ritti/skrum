import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTrans } from '@/hooks/use-trans';
import { localeName } from '@/lib/locale-names';
import type { GameRoomAccess } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type RoomSettingsValues = {
    name: string;
    access: GameRoomAccess;
    locale: string;
    reactionsEnabled: boolean;
};

function RoomSettingsFields({
    values,
    onChange,
}: {
    values: RoomSettingsValues;
    onChange: (values: RoomSettingsValues) => void;
}) {
    const { snapshot } = useRoom();
    const { t } = useTrans();
    const { locales } = usePage().props;

    return (
        <>
            <div className="grid gap-2">
                <Label htmlFor="room-name">{t('Name')}</Label>
                <Input
                    id="room-name"
                    value={values.name}
                    maxLength={60}
                    required
                    onChange={(event) =>
                        onChange({ ...values, name: event.target.value })
                    }
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="room-access">{t('Who can join')}</Label>
                <Select
                    value={values.access}
                    onValueChange={(access) =>
                        onChange({
                            ...values,
                            access: access as GameRoomAccess,
                        })
                    }
                >
                    <SelectTrigger id="room-access">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="team">
                            {t('Team members only')}
                        </SelectItem>
                        <SelectItem value="link">
                            {t('Anyone with the link')}
                        </SelectItem>
                    </SelectContent>
                </Select>
                {snapshot.room.access === 'link' &&
                    values.access === 'team' && (
                        <p className="text-sm text-muted-foreground">
                            {t('Guests in this room lose access.')}
                        </p>
                    )}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="room-locale">
                    {t('Language of words and questions')}
                </Label>
                <Select
                    value={values.locale}
                    onValueChange={(locale) => onChange({ ...values, locale })}
                >
                    <SelectTrigger id="room-locale">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {locales.map((code) => (
                            <SelectItem key={code} value={code}>
                                <span lang={code}>{localeName(code)}</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Switch
                id="room-reactions"
                checked={values.reactionsEnabled}
                onCheckedChange={(reactionsEnabled) =>
                    onChange({ ...values, reactionsEnabled })
                }
                label={t('Reactions')}
                description={t(
                    'Players can send emoji reactions during the game.',
                )}
            />
        </>
    );
}

/** Mounted by the menu only while it is open, so it always starts from the room as it is. */
export function RoomSettingsDialog({ open, onOpenChange }: Props) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { room } = ctx.snapshot;
    const [values, setValues] = useState<RoomSettingsValues>({
        name: room.name ?? '',
        access: room.access,
        locale: room.locale,
        reactionsEnabled: room.reactionsEnabled,
    });

    const save = async () => {
        const result = await ctx.run(
            retroRequest(GameRoomsController.update(room.id), {
                name: values.name.trim(),
                access: values.access,
                locale: values.locale,
                reactions_enabled: values.reactionsEnabled,
            }),
        );

        if (result === undefined) {
            throw new Error('The room settings were not saved.');
        }

        await ctx.refetch();
    };

    return (
        <FormDialog
            open={open}
            onOpenChange={onOpenChange}
            title={t('Room settings')}
            submitLabel={t('Save')}
            onSubmit={save}
        >
            <RoomSettingsFields values={values} onChange={setValues} />
        </FormDialog>
    );
}
