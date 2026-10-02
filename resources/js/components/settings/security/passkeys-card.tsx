import { router } from '@inertiajs/react';
import { usePasskeyRegister } from '@laravel/passkeys/react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { destroy } from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyRegistrationController';
import { SettingsCard } from '@/components/settings/settings-card';
import { ConfirmDialog, FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { Passkey } from '@/types/auth';

/** "Chrome on Mac": the name offered for a new passkey. */
export function defaultPasskeyName(userAgent: string): string {
    const browser = [
        { pattern: /Edg|Edge/, name: 'Edge' },
        { pattern: /OPR|Opera|OPiOS/, name: 'Opera' },
        { pattern: /Firefox|FxiOS/, name: 'Firefox' },
        { pattern: /Chrome|CriOS/, name: 'Chrome' },
        { pattern: /Safari/, name: 'Safari' },
    ].find(({ pattern }) => pattern.test(userAgent))?.name;

    const system = [
        { pattern: /iPhone/, name: 'iPhone' },
        { pattern: /iPad|Macintosh(?=.*Mobile)/, name: 'iPad' },
        { pattern: /Android/, name: 'Android' },
        { pattern: /Mac/, name: 'Mac' },
        { pattern: /Windows/, name: 'Windows' },
    ].find(({ pattern }) => pattern.test(userAgent))?.name;

    return [browser, system].filter(Boolean).join(' on ');
}

function PasskeyRow({
    passkey,
    onRemove,
}: {
    passkey: Passkey;
    onRemove: () => void;
}): ReactElement {
    const { t } = useTrans();

    return (
        <li
            data-slot="passkey-row"
            className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 border-b px-5 py-4 last:border-b-0"
        >
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <KeyRound aria-hidden="true" className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-sm font-semibold">
                        {passkey.name}
                    </span>
                    {passkey.authenticator !== null && (
                        <Badge variant="outline" shape="pill">
                            {passkey.authenticator}
                        </Badge>
                    )}
                </span>
                <span className="text-sm text-muted-foreground">
                    {t('Added :time', { time: passkey.created_at_diff })}
                    {passkey.last_used_at_diff !== null && (
                        <>
                            {' · '}
                            {t('Last used :time', {
                                time: passkey.last_used_at_diff,
                            })}
                        </>
                    )}
                </span>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('Remove :name', { name: passkey.name })}
                className="max-w-full text-skrum-destructive-text hover:text-skrum-destructive-text"
                onClick={onRemove}
            >
                <Trash2 aria-hidden="true" />
                <span className="truncate">{t('Remove')}</span>
            </Button>
        </li>
    );
}

type PasskeysCardProps = {
    passkeys: Passkey[];
};

export function PasskeysCard({ passkeys }: PasskeysCardProps): ReactElement {
    const { t } = useTrans();
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [target, setTarget] = useState<Passkey | null>(null);
    const registered = useRef(false);
    const { register, error, isSupported } = usePasskeyRegister({
        onSuccess: () => {
            registered.current = true;
        },
    });

    const add = async (data: FormData): Promise<void> => {
        const entry = data.get('name');
        const name = typeof entry === 'string' ? entry.trim() : '';

        if (name === '') {
            document.getElementById('passkey-name')?.focus();

            throw new Error('A passkey needs a name.');
        }

        registered.current = false;
        await register(name);

        if (!registered.current) {
            throw new Error('The passkey was not registered.');
        }

        router.reload();
    };

    const remove = (passkey: Passkey): Promise<void> =>
        new Promise((resolve, reject) => {
            router.delete(destroy.url(passkey.id), {
                preserveScroll: true,
                onSuccess: () => resolve(),
                onError: () => reject(new Error('The passkey is still here.')),
            });
        });

    return (
        <SettingsCard
            title={t('Passkeys')}
            description={t('Manage your passkeys for passwordless sign-in')}
            flush
            footer={
                isSupported ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="max-w-full"
                        onClick={() => setAdding(true)}
                    >
                        <Plus aria-hidden="true" />
                        <span className="truncate">{t('Add passkey')}</span>
                    </Button>
                ) : undefined
            }
        >
            {passkeys.length === 0 ? (
                <div
                    data-slot="passkeys-empty"
                    className="flex flex-col items-center gap-1 px-5 py-8 text-center"
                >
                    <span className="mb-2 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                        <KeyRound aria-hidden="true" className="size-5" />
                    </span>
                    <p className="text-sm font-semibold">
                        {t('No passkeys yet')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {t('Add a passkey to sign in without a password')}
                    </p>
                </div>
            ) : (
                <ul aria-label={t('Passkeys')} className="flex flex-col">
                    {passkeys.map((passkey) => (
                        <PasskeyRow
                            key={passkey.id}
                            passkey={passkey}
                            onRemove={() => {
                                setTarget(passkey);
                                setRemoving(true);
                            }}
                        />
                    ))}
                </ul>
            )}

            {!isSupported && (
                <div className="border-t p-5">
                    <Alert
                        variant="info"
                        title={t('Passkeys are not supported in this browser.')}
                    />
                </div>
            )}

            <FormDialog
                open={adding}
                onOpenChange={setAdding}
                title={t('Add passkey')}
                submitLabel={t('Register passkey')}
                onSubmit={add}
                error={adding ? (error ?? undefined) : undefined}
            >
                <TextField
                    id="passkey-name"
                    name="name"
                    label={t('Passkey name')}
                    defaultValue={defaultPasskeyName(navigator.userAgent)}
                    placeholder={t('e.g., MacBook Pro, iPhone')}
                    description={t(
                        'A name helps you identify this passkey later.',
                    )}
                    autoComplete="off"
                    autoFocus
                />
            </FormDialog>

            <ConfirmDialog
                open={removing}
                onOpenChange={setRemoving}
                tone="destructive"
                title={t('Remove passkey')}
                description={t(
                    'Are you sure you want to remove the ":name" passkey? You will no longer be able to use it to sign in.',
                    { name: target?.name ?? '' },
                )}
                confirmLabel={t('Remove passkey')}
                onConfirm={() =>
                    target === null ? Promise.resolve() : remove(target)
                }
            />
        </SettingsCard>
    );
}
