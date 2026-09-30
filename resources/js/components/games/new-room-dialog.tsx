import { useForm } from '@inertiajs/react';
import { useState, type FormEvent } from 'react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
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
import type { GameKind, GameRoomAccess } from '@/lib/games/types';
import type { GameOption } from '@/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    gameOptions: GameOption[];
};

type RoomForm = {
    name: string;
    game: GameKind | '';
    access: GameRoomAccess;
};

export function NewRoomDialog(props: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>{t('New room')}</Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                {open && (
                    <NewRoomForm {...props} onDone={() => setOpen(false)} />
                )}
            </DialogContent>
        </Dialog>
    );
}

function NewRoomForm({
    workspaceSlug,
    teamId,
    gameOptions,
    onDone,
}: Props & { onDone: () => void }) {
    const { t } = useTrans();
    const available = gameOptions.filter((option) => option.available);
    const form = useForm<RoomForm>({
        name: '',
        game: available[0]?.value ?? '',
        access: 'team',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.submit(
            TeamGameRoomsController.store({
                workspace: workspaceSlug,
                team: teamId,
            }),
            { onSuccess: onDone },
        );
    };

    return (
        <form onSubmit={submit} className="space-y-4">
            <DialogTitle>{t('New room')}</DialogTitle>

            <div className="grid gap-2">
                <Label htmlFor="new-room-name">{t('Name')}</Label>
                <Input
                    id="new-room-name"
                    value={form.data.name}
                    maxLength={60}
                    required
                    autoFocus
                    onChange={(event) =>
                        form.setData('name', event.target.value)
                    }
                />
                <InputError message={form.errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="new-room-game">{t('First game')}</Label>
                <Select
                    value={form.data.game}
                    onValueChange={(value) =>
                        form.setData('game', value as GameKind)
                    }
                >
                    <SelectTrigger id="new-room-game">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {available.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={form.errors.game} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="new-room-access">{t('Who can join')}</Label>
                <Select
                    value={form.data.access}
                    onValueChange={(value) =>
                        form.setData('access', value as GameRoomAccess)
                    }
                >
                    <SelectTrigger id="new-room-access">
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
                <InputError message={form.errors.access} />
            </div>

            <DialogFooter className="gap-2">
                <Button type="button" variant="secondary" onClick={onDone}>
                    {t('Cancel')}
                </Button>
                <Button disabled={form.processing || form.data.game === ''}>
                    {t('Create room')}
                </Button>
            </DialogFooter>
        </form>
    );
}
