import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { SettingRow } from '@/components/teams/session-create/setting-row';
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
            <div className="flex flex-col border-y">
                <SettingRow
                    label={t('Allow guests without an account')}
                    htmlFor="room-guests"
                    help={
                        snapshot.room.access === 'link' &&
                        values.access === 'team'
                            ? t('Guests in this room lose access.')
                            : t('Guests join with a nickname, no account')
                    }
                >
                    <Switch
                        id="room-guests"
                        checked={values.access === 'link'}
                        onCheckedChange={(guests) =>
                            onChange({
                                ...values,
                                access: guests ? 'link' : 'team',
                            })
                        }
                    />
                </SettingRow>
                <SettingRow
                    label={t('Language of words and questions')}
                    htmlFor="room-locale"
                    help={t('The language the games draw their words from.')}
                >
                    <Select
                        value={values.locale}
                        onValueChange={(locale) =>
                            onChange({ ...values, locale })
                        }
                    >
                        <SelectTrigger
                            id="room-locale"
                            size="sm"
                            className="max-w-full"
                        >
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
                </SettingRow>
                <SettingRow
                    label={t('Reactions')}
                    htmlFor="room-reactions"
                    help={t(
                        'Players can send emoji reactions during the game.',
                    )}
                >
                    <Switch
                        id="room-reactions"
                        checked={values.reactionsEnabled}
                        onCheckedChange={(reactionsEnabled) =>
                            onChange({ ...values, reactionsEnabled })
                        }
                    />
                </SettingRow>
            </div>
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
            submitDisabled={values.name.trim() === ''}
            onSubmit={save}
        >
            <RoomSettingsFields values={values} onChange={setValues} />
        </FormDialog>
    );
}
