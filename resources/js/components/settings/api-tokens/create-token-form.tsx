import { useForm } from '@inertiajs/react';
import { CircleAlert, Plus } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import ApiTokensController from '@/actions/App/Http/Controllers/Settings/ApiTokensController';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Checkbox } from '@/components/ui/checkbox';
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
    ApiTokenScope,
    ApiTokenTeamGroup,
    NewApiToken,
} from '@/types';
import { NewTokenPanel } from './new-token-panel';

const AllTeams = 'all';

type TokenForm = {
    name: string;
    scopes: ApiTokenScope[];
    team_id: string | null;
    expiration: ApiTokenExpiration;
};

type CreateTokenFormProps = {
    teamGroups: ApiTokenTeamGroup[];
    expirationOptions: ApiTokenExpirationOption[];
    defaultExpiration: ApiTokenExpiration;
    mcpUrl: string;
    /** The token that was just created: shown once, in place of the footer. */
    newToken: NewApiToken | null;
    onDone: () => void;
};

function FieldError({
    id,
    message,
}: {
    id: string;
    message?: string;
}): ReactElement | null {
    if (!message) {
        return null;
    }

    return (
        <span
            id={id}
            data-slot="field-error"
            className="flex items-start gap-1.5 text-body-sm text-skrum-destructive-text"
        >
            <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0">{message}</span>
        </span>
    );
}

function ScopeCode({ scope }: { scope: ApiTokenScope }): ReactElement {
    return (
        <code className="rounded-xs border bg-muted px-1.5 font-mono text-xs/4.5 font-medium whitespace-nowrap text-foreground">
            {scope}
        </code>
    );
}

export function CreateTokenForm({
    teamGroups,
    expirationOptions,
    defaultExpiration,
    mcpUrl,
    newToken,
    onDone,
}: CreateTokenFormProps): ReactElement {
    const { t } = useTrans();
    const form = useForm<TokenForm>({
        name: '',
        scopes: [],
        team_id: null,
        expiration: defaultExpiration,
    });
    const errors = form.errors as Record<string, string | undefined>;
    const scopeError = Object.entries(errors)
        .filter(([key]) => key === 'scopes' || key.startsWith('scopes.'))
        .map(([, message]) => message)
        .join(' ');
    const refused = ['name', 'expiration', 'team_id'].find(
        (key) => errors[key] !== undefined,
    );

    /* A refused value gives the focus back to its field. */
    useEffect(() => {
        const fields: Record<string, string> = {
            name: 'token-name',
            expiration: 'token-expiration',
            team_id: 'token-team',
        };

        if (refused !== undefined && !form.processing) {
            document.getElementById(fields[refused])?.focus();
        }
    }, [refused, form.processing]);

    const toggleScope = (scope: ApiTokenScope, checked: boolean): void =>
        form.setData(
            'scopes',
            checked
                ? [...form.data.scopes, scope]
                : form.data.scopes.filter((value) => value !== scope),
        );

    const submit = (): void => {
        if (newToken !== null) {
            return;
        }

        form.submit(ApiTokensController.store(), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <form
            data-slot="create-token-form"
            aria-label={t('New API token')}
            className="min-w-0"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <SettingsCard
                title={t('API tokens')}
                description={t(
                    'Connect an AI assistant that supports MCP to skrum with a personal token.',
                )}
                footer={
                    newToken === null ? (
                        <LoadingButton
                            type="submit"
                            size="sm"
                            loading={form.processing}
                            className="max-w-full"
                        >
                            <Plus aria-hidden="true" />
                            <span className="truncate">
                                {t('Create token')}
                            </span>
                        </LoadingButton>
                    ) : undefined
                }
            >
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
                    <TextField
                        id="token-name"
                        label={t('Token name')}
                        value={form.data.name}
                        maxLength={60}
                        required
                        autoComplete="off"
                        error={errors.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                    />

                    <div className="flex min-w-0 flex-col gap-1.5">
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
                            <SelectTrigger
                                id="token-expiration"
                                className="w-full"
                                aria-invalid={
                                    errors.expiration ? true : undefined
                                }
                                aria-describedby={
                                    errors.expiration
                                        ? 'token-expiration-error'
                                        : undefined
                                }
                            >
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
                        <FieldError
                            id="token-expiration-error"
                            message={errors.expiration}
                        />
                    </div>

                    <div className="flex min-w-0 flex-col gap-1.5">
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
                            <SelectTrigger
                                id="token-team"
                                className="w-full"
                                aria-invalid={errors.team_id ? true : undefined}
                                aria-describedby={
                                    errors.team_id
                                        ? 'token-team-error'
                                        : undefined
                                }
                            >
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
                        <FieldError
                            id="token-team-error"
                            message={errors.team_id}
                        />
                    </div>
                </div>

                <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className="mb-2 text-sm font-medium">
                        {t('Scopes')}
                    </legend>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-x-4 gap-y-2">
                        <div className="flex min-w-0 items-start gap-2">
                            <Checkbox
                                id="scope-read"
                                checked
                                disabled
                                className="mt-0.5"
                            />
                            <label
                                htmlFor="scope-read"
                                className="flex min-w-0 flex-col items-start text-body-sm"
                            >
                                <ScopeCode scope="mcp:read" />{' '}
                                <span className="text-muted-foreground">
                                    {t('Read')}
                                </span>
                            </label>
                        </div>
                        <div className="flex min-w-0 items-start gap-2">
                            <Checkbox
                                id="scope-write"
                                checked={form.data.scopes.includes('mcp:write')}
                                className="mt-0.5"
                                onCheckedChange={(checked) =>
                                    toggleScope('mcp:write', checked === true)
                                }
                            />
                            <label
                                htmlFor="scope-write"
                                className="flex min-w-0 cursor-pointer flex-col items-start text-body-sm"
                            >
                                <ScopeCode scope="mcp:write" />{' '}
                                <span className="text-muted-foreground">
                                    {t('Create and update')}
                                </span>
                            </label>
                        </div>
                        <div className="flex min-w-0 items-start gap-2">
                            <Checkbox
                                id="scope-delete"
                                checked={form.data.scopes.includes(
                                    'mcp:delete',
                                )}
                                aria-describedby="scope-delete-help"
                                className="mt-0.5"
                                onCheckedChange={(checked) =>
                                    toggleScope('mcp:delete', checked === true)
                                }
                            />
                            <div className="flex min-w-0 flex-col items-start text-body-sm">
                                <label
                                    htmlFor="scope-delete"
                                    className="flex min-w-0 cursor-pointer flex-col items-start"
                                >
                                    <ScopeCode scope="mcp:delete" />{' '}
                                    <span className="text-muted-foreground">
                                        {t('Delete my messages')}
                                    </span>
                                </label>
                                <span
                                    id="scope-delete-help"
                                    className="text-xs text-muted-foreground"
                                >
                                    {t(
                                        'Lets the client delete messages you wrote.',
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                    <FieldError id="token-scopes-error" message={scopeError} />
                </fieldset>

                {newToken !== null && (
                    <NewTokenPanel
                        token={newToken}
                        mcpUrl={mcpUrl}
                        onDone={onDone}
                    />
                )}
            </SettingsCard>
        </form>
    );
}
