import { useForm } from '@inertiajs/react';
import { useState } from 'react';
import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    ApiTokenExpiration,
    ApiTokenExpirationOption,
    ApiTokenTeamGroup,
} from '@/types';

const AllTeams = 'all';

type Props = {
    teamGroups: ApiTokenTeamGroup[];
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
};

type TokenForm = {
    name: string;
    scopes: string[];
    team_id: string | null;
    expiration: ApiTokenExpiration;
};

export function CreateTokenDialog({
    teamGroups,
    expirationOptions,
    defaultExpiration,
}: Props) {
    const { t } = useTrans();
    const [open, setOpen] = useState(false);
    const form = useForm<TokenForm>({
        name: '',
        scopes: [],
        team_id: null,
        expiration: defaultExpiration,
    });

    const scopeError = Object.entries(form.errors as Record<string, string>)
        .filter(([key]) => key === 'scopes' || key.startsWith('scopes.'))
        .map(([, message]) => message)
        .join(' ');

    const toggleScope = (scope: string, checked: boolean) =>
        form.setData(
            'scopes',
            checked
                ? [...form.data.scopes, scope]
                : form.data.scopes.filter((value) => value !== scope),
        );

    const submit = () =>
        form.submit(ApiTokensController.store(), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setOpen(false);
            },
        });

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    form.reset();
                    form.clearErrors();
                }
            }}
        >
            <DialogTrigger asChild>
                <Button>{t('Create token')}</Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined}>
                <DialogTitle>{t('Create token')}</DialogTitle>

                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="grid gap-2">
                        <Label htmlFor="token-name">{t('Name')}</Label>
                        <Input
                            id="token-name"
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

                    <fieldset className="grid gap-2">
                        <legend className="mb-1 text-sm font-medium">
                            {t('Permissions')}
                        </legend>
                        <div className="flex items-center gap-3">
                            <Checkbox id="scope-read" checked disabled />
                            <Label htmlFor="scope-read">{t('Read')}</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="scope-write"
                                checked={form.data.scopes.includes('mcp:write')}
                                onCheckedChange={(checked) =>
                                    toggleScope('mcp:write', checked === true)
                                }
                            />
                            <Label htmlFor="scope-write">
                                {t('Create and update')}
                            </Label>
                        </div>
                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="scope-delete"
                                checked={form.data.scopes.includes(
                                    'mcp:delete',
                                )}
                                onCheckedChange={(checked) =>
                                    toggleScope('mcp:delete', checked === true)
                                }
                            />
                            <div className="grid gap-1">
                                <Label htmlFor="scope-delete">
                                    {t('Delete my messages')}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Lets the client delete messages you wrote.',
                                    )}
                                </p>
                            </div>
                        </div>
                        <InputError message={scopeError} />
                    </fieldset>

                    <div className="grid gap-2">
                        <Label htmlFor="token-team">{t('Team')}</Label>
                        <Select
                            value={form.data.team_id ?? AllTeams}
                            onValueChange={(value) =>
                                form.setData(
                                    'team_id',
                                    value === AllTeams ? null : value,
                                )
                            }
                        >
                            <SelectTrigger id="token-team">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={AllTeams}>
                                    {t('All my teams')}
                                </SelectItem>
                                {teamGroups.map((group) => (
                                    <SelectGroup key={group.workspace.id}>
                                        <SelectLabel>
                                            {group.workspace.name}
                                        </SelectLabel>
                                        {group.teams.map((team) => (
                                            <SelectItem
                                                key={team.id}
                                                value={team.id}
                                            >
                                                {team.name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.team_id} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="token-expiration">
                            {t('Expiration')}
                        </Label>
                        <Select
                            value={form.data.expiration}
                            onValueChange={(value) =>
                                form.setData(
                                    'expiration',
                                    value as ApiTokenExpiration,
                                )
                            }
                        >
                            <SelectTrigger id="token-expiration">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {expirationOptions.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <InputError message={form.errors.expiration} />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setOpen(false)}
                        >
                            {t('Cancel')}
                        </Button>
                        <Button disabled={form.processing}>
                            {t('Create token')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
