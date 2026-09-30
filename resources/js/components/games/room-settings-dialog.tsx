import { usePage } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import GameRoomsController from '@/actions/App/Http/Controllers/Games/GameRoomsController';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { GameRoomAccess } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function RoomSettingsDialog({ open, onOpenChange }: Props) {
    const { t } = useTrans();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Room settings')}</DialogTitle>
                {open && (
                    <RoomSettingsForm onDone={() => onOpenChange(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

const LocaleNames: Record<string, string> = {
    en: 'English',
    fr: 'Français',
    es: 'Español',
    de: 'Deutsch',
};

function RoomSettingsForm({ onDone }: { onDone: () => void }) {
    const ctx = useRoom();
    const { t } = useTrans();
    const { locales } = usePage().props;
    const { room } = ctx.snapshot;
    const [name, setName] = useState(room.name ?? '');
    const [access, setAccess] = useState<GameRoomAccess>(room.access);
    const [locale, setLocale] = useState(room.locale);
    const [busy, setBusy] = useState(false);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);

        let result: unknown;

        try {
            result = await ctx.run(
                retroRequest(GameRoomsController.update(room.id), {
                    name: name.trim(),
                    access,
                    locale,
                }),
            );
        } finally {
            setBusy(false);
        }

        if (result !== undefined) {
            await ctx.refetch();
            onDone();
        }
    };

    return (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="room-name">{t('Name')}</Label>
                <Input
                    id="room-name"
                    value={name}
                    maxLength={60}
                    required
                    onChange={(event) => setName(event.target.value)}
                />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="room-access">{t('Who can join')}</Label>
                <Select
                    value={access}
                    onValueChange={(value) =>
                        setAccess(value as GameRoomAccess)
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
                {room.access === 'link' && access === 'team' && (
                    <p className="text-sm text-muted-foreground">
                        {t('Guests in this room lose access.')}
                    </p>
                )}
            </div>
            <div className="grid gap-2">
                <Label htmlFor="room-locale">
                    {t('Language of words and questions')}
                </Label>
                <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger id="room-locale">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {locales.map((code) => (
                            <SelectItem key={code} value={code}>
                                {LocaleNames[code] ?? code}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={busy || name.trim() === ''}>
                    {t('Save')}
                </Button>
            </DialogFooter>
        </form>
    );
}
