import { CircleAlert, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import { useTrans } from '@/hooks/use-trans';
import type { SignupMode } from '@/lib/admin/types';

/** The server's rule (`ConfigurationFieldKind::HostNamePattern`). */
const DomainPattern =
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const DomainMaxLength = 253;
export const MaxAllowedEmailDomains = 20;

export function isDomain(value: string): boolean {
    return value.length <= DomainMaxLength && DomainPattern.test(value);
}

type SignupCardProps = {
    mode: SignupMode;
    domains: string[];
    defaults: { signupMode: SignupMode; allowedEmailDomains: string[] };
    onModeChange: (mode: SignupMode) => void;
    onDomainsChange: (domains: string[]) => void;
    /** Refusal of the mode, from the server. */
    modeError?: string;
    /** Refusal of the domains: the form's own, or the server's. */
    error?: string;
};

function FieldError({ id, message }: { id: string; message: string }) {
    return (
        <p
            id={id}
            data-slot="field-error"
            className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
        >
            <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0">{message}</span>
        </p>
    );
}

export function SignupCard({
    mode,
    domains,
    defaults,
    onModeChange,
    onDomainsChange,
    modeError,
    error,
}: SignupCardProps) {
    const { t } = useTrans();
    const inputId = useId();
    const errorId = useId();
    const modeErrorId = useId();
    const hintId = useId();
    const [typed, setTyped] = useState('');
    const [typedError, setTypedError] = useState<string>();
    const labels: Record<SignupMode, string> = {
        invite: t('Invitation only'),
        open: t('Open to everyone'),
        domain: t('Allowed domains'),
    };
    const shownError = typedError ?? error;
    const full = domains.length >= MaxAllowedEmailDomains;

    function addOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        add();
    }

    function add(): void {
        const domain = typed.trim().toLowerCase();

        if (domain === '') {
            return;
        }

        if (!isDomain(domain)) {
            setTypedError(t('Enter a domain such as example.com.'));

            return;
        }

        setTyped('');
        setTypedError(undefined);

        if (domains.includes(domain)) {
            return;
        }

        onDomainsChange([...domains, domain]);
    }

    return (
        <SettingsCard
            title={t('Sign-up')}
            description={t('Who can create an account on this instance.')}
        >
            <div className="flex min-w-0 flex-col gap-2">
                <RadioGroup<SignupMode>
                    aria-label={t('Sign-up')}
                    aria-invalid={modeError ? true : undefined}
                    aria-errormessage={modeError ? modeErrorId : undefined}
                    value={mode}
                    onValueChange={onModeChange}
                    options={(['invite', 'open', 'domain'] as const).map(
                        (value) => ({ value, label: labels[value] }),
                    )}
                />
                {modeError !== undefined && (
                    <FieldError id={modeErrorId} message={modeError} />
                )}
                <p
                    data-slot="signup-default"
                    className="text-body-sm text-muted-foreground"
                >
                    {t('Default from the environment: :value', {
                        value: labels[defaults.signupMode],
                    })}
                </p>
            </div>
            {mode === 'domain' && (
                <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={inputId}>{t('E-mail domains')}</Label>
                    {domains.length > 0 && (
                        <ul
                            role="list"
                            data-slot="domain-chips"
                            className="flex min-w-0 flex-wrap gap-2"
                        >
                            {domains.map((domain) => (
                                <li
                                    key={domain}
                                    className="flex max-w-full min-w-0 items-center gap-1 rounded-full border bg-muted py-0.5 pr-0.5 pl-3 font-mono text-sm"
                                >
                                    <span className="min-w-0 truncate">
                                        {domain}
                                    </span>
                                    <button
                                        type="button"
                                        aria-label={t('Remove :name', {
                                            name: domain,
                                        })}
                                        onClick={() =>
                                            onDomainsChange(
                                                domains.filter(
                                                    (kept) => kept !== domain,
                                                ),
                                            )
                                        }
                                        className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <X
                                            aria-hidden="true"
                                            className="size-3.5"
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Input
                        id={inputId}
                        value={typed}
                        disabled={full}
                        placeholder="example.com"
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(event) => {
                            setTyped(event.target.value);
                            setTypedError(undefined);
                        }}
                        onKeyDown={addOnEnter}
                        onBlur={add}
                        aria-invalid={shownError ? true : undefined}
                        aria-describedby={shownError ? errorId : hintId}
                        className="font-mono"
                    />
                    {shownError !== undefined ? (
                        <FieldError id={errorId} message={shownError} />
                    ) : (
                        <p
                            id={hintId}
                            className="text-body-sm text-muted-foreground"
                        >
                            {full
                                ? t('At most :max domains.', {
                                      max: MaxAllowedEmailDomains,
                                  })
                                : t('Type a domain and press Enter.')}
                        </p>
                    )}
                    {defaults.allowedEmailDomains.length > 0 && (
                        <p className="text-body-sm text-muted-foreground">
                            {t('Default from the environment: :value', {
                                value: defaults.allowedEmailDomains.join(', '),
                            })}
                        </p>
                    )}
                </div>
            )}
        </SettingsCard>
    );
}
