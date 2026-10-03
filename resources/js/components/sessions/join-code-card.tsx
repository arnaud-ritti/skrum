import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { LoadingButton } from '@/components/skrum/loading-button';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { TextField } from '@/components/skrum/text-field';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTrans } from '@/hooks/use-trans';
import { formatAsTyped, normaliseJoinCode } from '@/lib/sessions/join-code';
import { cn } from '@/lib/utils';

export type JoinCodeCardProps = {
    /** The server's answer to the last code sent ("No session matches this code."). */
    error?: string | null;
    processing?: boolean;
    /** Called with the code in its written form, `K7Q-P4M2`. */
    onSubmit: (code: string) => void;
    loginUrl: string;
    /** Pins the button to the bottom of the viewport (phone), as `GuestJoin`. */
    stickyAction?: boolean;
    /** Off inside a page frame that already shows the instance's own logo. */
    logo?: boolean;
    className?: string;
};

const CodeLength = 7;

/**
 * Only a wrong length is said here (spec §8.9). A code of the right length
 * with a look-alike goes to the server, which answers it like any unknown code.
 */
function hasFullLength(code: string): boolean {
    return code.replace('-', '').length === CodeLength;
}

/**
 * "Join a session":the code read aloud by a facilitator, in the GuestJoin
 * card's frame (no mockup of its own, deviation P26-08). The field follows the
 * `Input` mockup's "Session code" states.
 */
export function JoinCodeCard({
    error = null,
    processing = false,
    onSubmit,
    loginUrl,
    stickyAction = false,
    logo = true,
    className,
}: JoinCodeCardProps) {
    const { t } = useTrans();
    const [code, setCode] = useState('');
    const [isTooShort, setIsTooShort] = useState(false);
    const [editedPast, setEditedPast] = useState<string | null>(null);
    const serverError = error !== null && editedPast !== error ? error : null;
    const fieldError = isTooShort
        ? t('The code has 8 characters')
        : (serverError ?? undefined);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (processing) {
            return;
        }

        if (!hasFullLength(code)) {
            setIsTooShort(true);

            return;
        }

        onSubmit(normaliseJoinCode(code) ?? code);
    };

    return (
        <Card
            data-slot="join-code"
            className={cn(
                'mx-auto w-full max-w-md gap-5 p-6 shadow-card',
                className,
            )}
        >
            <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
                {logo && (
                    <SkrumLogo
                        variant="horizontal"
                        className="h-6 w-auto self-start"
                    />
                )}

                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-title tracking-subheading">
                        {t('Join a session')}
                    </h2>
                    <p className="text-sm/snug text-muted-foreground">
                        {t('Type the code the facilitator shared.')}
                    </p>
                </div>

                <TextField
                    id="code"
                    name="code"
                    label={t('Session code')}
                    value={code}
                    placeholder="ABC-1234"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="characters"
                    inputMode="text"
                    spellCheck={false}
                    error={fieldError}
                    className="font-mono tracking-wider uppercase max-md:h-12"
                    onChange={(event) => {
                        setCode(formatAsTyped(event.target.value));
                        setIsTooShort(false);
                        setEditedPast(error);
                    }}
                />

                <div
                    data-slot="join-code-action"
                    className={cn(
                        stickyAction &&
                            'sticky bottom-0 -mx-6 border-t bg-card px-6 py-3',
                    )}
                >
                    <LoadingButton
                        type="submit"
                        size="lg"
                        className="w-full"
                        loading={processing}
                    >
                        <span className="truncate">{t('Continue')}</span>
                        {!processing && <ArrowRight aria-hidden />}
                    </LoadingButton>
                </div>
            </form>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
                {t('Have an account?')}{' '}
                <Link
                    href={loginUrl}
                    className="font-medium text-skrum-primary-text underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {t('Sign in')}
                </Link>
            </p>
        </Card>
    );
}
