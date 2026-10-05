import { Check, Circle, ShieldCheck } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type PasswordStrengthLevel = 'weak' | 'good' | 'strong';

type PasswordStrengthEstimate = {
    /** Segments of the meter that are on, from 0 (nothing typed) to 4. */
    score: 0 | 1 | 2 | 3 | 4;
    level: PasswordStrengthLevel | null;
};

type PasswordCharacterClass = 'lower' | 'upper' | 'digit' | 'special';

type PasswordRule =
    | { kind: 'minlength'; count: number }
    | { kind: 'maxlength'; count: number }
    | { kind: 'required'; characters: PasswordCharacterClass };

const MeterSegments = 4;

const characterClasses: Record<PasswordCharacterClass, RegExp> = {
    lower: /\p{Ll}/u,
    upper: /\p{Lu}/u,
    digit: /\p{N}/u,
    special: /[\p{Z}\p{S}\p{P}]/u,
};

function countCharacterClasses(password: string): number {
    return Object.values(characterClasses).filter((pattern) =>
        pattern.test(password),
    ).length;
}

/**
 * A client-side estimate over length and character classes. It guides the
 * typing; the server's rule, listed by `PasswordRules`, is what decides.
 */
export function estimatePasswordStrength(
    password: string,
    minLength = 0,
): PasswordStrengthEstimate {
    const length = Array.from(password).length;

    if (length === 0) {
        return { score: 0, level: null };
    }

    if (length < Math.max(8, minLength)) {
        return { score: 1, level: 'weak' };
    }

    const classes = countCharacterClasses(password);

    if (
        (length >= 12 && classes === 4) ||
        (length >= 16 && classes >= 3) ||
        (length >= 20 && classes >= 2)
    ) {
        return { score: 4, level: 'strong' };
    }

    if (length >= 12 || classes >= 3) {
        return { score: 3, level: 'good' };
    }

    return { score: 2, level: 'weak' };
}

/** The minimum length of the server's rule, 0 when it sets none. */
export function passwordMinLength(rules: string): number {
    const rule = parsePasswordRules(rules).find(
        (candidate) => candidate.kind === 'minlength',
    );

    return rule?.kind === 'minlength' ? rule.count : 0;
}

/** Reads the string of `Password::defaults()->toPasswordRulesString()`. */
export function parsePasswordRules(rules: string): PasswordRule[] {
    return rules
        .split(';')
        .map((rule) => rule.split(':').map((part) => part.trim()))
        .flatMap(([name, value]): PasswordRule[] => {
            if (name === 'minlength' || name === 'maxlength') {
                const count = Number.parseInt(value ?? '', 10);

                return Number.isNaN(count) ? [] : [{ kind: name, count }];
            }

            if (name === 'required' && value !== undefined) {
                return value in characterClasses
                    ? [
                          {
                              kind: 'required',
                              characters: value as PasswordCharacterClass,
                          },
                      ]
                    : [];
            }

            return [];
        });
}

function meetsPasswordRule(rule: PasswordRule, password: string): boolean {
    const length = Array.from(password).length;

    if (rule.kind === 'minlength') {
        return length >= rule.count;
    }

    if (rule.kind === 'maxlength') {
        return length > 0 && length <= rule.count;
    }

    return characterClasses[rule.characters].test(password);
}

export function PasswordStrength({
    password,
    minLength = 0,
}: {
    password: string;
    /** The server's minimum: a shorter password is weak whatever it holds. */
    minLength?: number;
}): ReactElement {
    const { t } = useTrans();
    const { score, level } = estimatePasswordStrength(password, minLength);
    const labels: Record<PasswordStrengthLevel, string> = {
        weak: t('Weak'),
        good: t('Good'),
        strong: t('Strong'),
    };
    const hints: Record<PasswordStrengthLevel, string> = {
        weak: t('add characters, and mix letters, numbers and symbols.'),
        good: t('add a symbol or more characters to make it strong.'),
        strong: t('long and varied enough.'),
    };

    return (
        <div
            data-slot="password-strength"
            data-level={level ?? 'empty'}
            className="flex min-w-0 flex-col"
        >
            <div
                role="meter"
                aria-label={t('Password strength')}
                aria-valuemin={0}
                aria-valuemax={MeterSegments}
                aria-valuenow={score}
                aria-valuetext={
                    level === null ? t('Nothing typed yet') : labels[level]
                }
                className="grid grid-cols-4 gap-1"
            >
                {Array.from({ length: MeterSegments }, (_, index) => (
                    <span
                        key={index}
                        data-slot="password-strength-segment"
                        data-on={index < score ? '' : undefined}
                        className={cn(
                            'block h-1.5 rounded-full bg-muted inset-ring inset-ring-border',
                            index < score && 'inset-ring-0',
                            index < score &&
                                (level === 'weak'
                                    ? 'bg-destructive'
                                    : 'bg-skrum-success'),
                        )}
                    />
                ))}
            </div>
            <div data-slot="password-strength-live" aria-live="polite">
                {level !== null && (
                    <p
                        data-slot="password-strength-label"
                        className="mt-1.5 text-body-sm text-muted-foreground"
                    >
                        <b
                            className={cn(
                                'font-semibold',
                                level === 'weak'
                                    ? 'text-skrum-destructive-text'
                                    : 'text-skrum-success-text',
                            )}
                        >
                            {labels[level]}
                        </b>
                        {' — '}
                        {hints[level]}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * The breach check of the server's rule where it cannot run while typing
 * (`BreachLine` falls back to it): it runs when the form is saved, so the
 * line informs and carries no met / not met mark.
 */
export function PasswordBreachCheck(): ReactElement {
    const { t } = useTrans();

    return (
        <li
            data-slot="password-breach-check"
            className="inline-flex items-center gap-1.5"
        >
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            <span>
                {t('Checked against known data breaches when you save')}
            </span>
        </li>
    );
}

/** The server's `DifferentFromIdentity` rule: the e-mail, its local part and the name, whatever the case. */
export function differsFromIdentity(
    password: string,
    identity: string[],
): boolean {
    const typed = password.trim().toLowerCase();

    if (typed === '') {
        return false;
    }

    return !identity
        .map((part) => part.trim().toLowerCase())
        .flatMap((part) =>
            part.includes('@') ? [part, part.split('@')[0]] : [part],
        )
        .includes(typed);
}

function RuleLine({
    met,
    label,
}: {
    met: boolean;
    label: string;
}): ReactElement {
    const { t } = useTrans();
    const Icon = met ? Check : Circle;

    return (
        <li
            data-met={met ? 'true' : 'false'}
            className="inline-flex items-center gap-1.5"
        >
            <Icon
                aria-hidden="true"
                className={cn(
                    'size-4 shrink-0',
                    met && 'text-skrum-success-text',
                )}
            />
            <span>{label}</span>
            <span className="sr-only">
                {met ? t('(met)') : t('(not met yet)')}
            </span>
        </li>
    );
}

export function PasswordRules({
    rules,
    password,
    identity,
    breachCheck,
}: {
    /** The server's rule, as `toPasswordRulesString()` writes it. */
    rules: string;
    password: string;
    /** The e-mail and the name of the account: the password must differ from them. */
    identity?: string[];
    /** Last item of the list: `BreachLine` when the server's rule has one. */
    breachCheck?: ReactNode;
}): ReactElement | null {
    const { t } = useTrans();
    const parsed = parsePasswordRules(rules);

    if (
        parsed.length === 0 &&
        breachCheck === undefined &&
        identity === undefined
    ) {
        return null;
    }

    const label = (rule: PasswordRule): string => {
        if (rule.kind === 'minlength') {
            return t('At least :count characters', { count: rule.count });
        }

        if (rule.kind === 'maxlength') {
            return t('At most :count characters', { count: rule.count });
        }

        return {
            lower: t('A lowercase letter'),
            upper: t('An uppercase letter'),
            digit: t('A number'),
            special: t('A symbol'),
        }[rule.characters];
    };

    return (
        <ul
            data-slot="password-rules"
            aria-label={t('Password rules')}
            className="flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-muted-foreground"
        >
            {parsed.map((rule) => (
                <RuleLine
                    key={`${rule.kind}-${'count' in rule ? rule.count : rule.characters}`}
                    met={meetsPasswordRule(rule, password)}
                    label={label(rule)}
                />
            ))}
            {breachCheck}
            {identity !== undefined && (
                <RuleLine
                    met={differsFromIdentity(password, identity)}
                    label={t('Different from your email and name')}
                />
            )}
        </ul>
    );
}
