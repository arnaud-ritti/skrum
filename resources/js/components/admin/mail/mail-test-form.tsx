import { useForm, usePage } from '@inertiajs/react';
import { CircleAlert, CircleCheck, Send } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import MailTestsController from '@/actions/App/Http/Controllers/Admin/MailTestsController';
import { describedBy } from '@/components/admin/configuration/configuration-field';
import { LoadingButton } from '@/components/skrum/loading-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDaysAgo } from '@/lib/days-ago';
import { useTrans } from '@/hooks/use-trans';
import type { MailLastTest } from '@/lib/admin/types';

const TooManyRequests = 429;

type MailTestFormProps = {
    defaultRecipient: string;
    lastTest: MailLastTest | null;
    /** The settings have unsaved changes: the test would not use them. */
    dirty: boolean;
    /** The mailer in force sends mails: a test written to the log proves nothing. */
    delivering: boolean;
};

/** Sends a test e-mail through the configuration in force, and says how the last one went. */
export function MailTestForm({
    defaultRecipient,
    lastTest,
    dirty,
    delivering,
}: MailTestFormProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const id = useId();
    const inputId = `${id}-to`;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const form = useForm({ to: defaultRecipient });
    const [throttled, setThrottled] = useState(false);
    const blocked = dirty || !delivering;
    const hint = dirty
        ? t('Save first to test these values.')
        : t(
              'Mails are written to the log: choose SMTP and save to send a test.',
          );
    const error = throttled
        ? t('Wait a few minutes before the next test.')
        : form.errors.to;

    function send(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (blocked || form.processing) {
            return;
        }

        setThrottled(false);
        form.post(MailTestsController.store.url(), {
            preserveScroll: true,
            onHttpException: (response) => {
                if (response.status !== TooManyRequests) {
                    return;
                }

                setThrottled(true);

                return false;
            },
        });
    }

    function failure(test: MailLastTest): string {
        if (test.error === 'log') {
            return t('no e-mail was sent, mails are written to the log.');
        }

        if (test.error === 'transport') {
            return t(
                'the mail server could not be reached or refused the message.',
            );
        }

        return t('an unexpected error stopped the e-mail.');
    }

    function resultLine(test: MailLastTest) {
        const relative = formatDaysAgo(test.at, locale, Date.now());
        const time = new Intl.DateTimeFormat(locale, {
            timeStyle: 'short',
        }).format(new Date(test.at));

        if (test.ok) {
            return (
                <p
                    data-slot="mail-test-result"
                    className="flex min-w-0 items-start gap-1.5 text-body-sm text-muted-foreground"
                >
                    <CircleCheck
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-skrum-success-text"
                    />
                    <span className="min-w-0">
                        {t('Last test delivered :relative at :time', {
                            relative,
                            time,
                        })}
                    </span>
                </p>
            );
        }

        return (
            <p
                data-slot="mail-test-result"
                className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
            >
                <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">
                    {t('Last test failed :relative at :time: :sentence', {
                        relative,
                        time,
                        sentence: failure(test),
                    })}
                </span>
            </p>
        );
    }

    return (
        <form
            onSubmit={send}
            data-slot="mail-test-form"
            className="flex min-w-0 flex-col gap-1.5"
        >
            <Label htmlFor={inputId}>{t('Send a test e-mail')}</Label>
            <div className="flex min-w-0 gap-2">
                <Input
                    id={inputId}
                    name="to"
                    type="email"
                    value={form.data.to}
                    onChange={(event) => form.setData('to', event.target.value)}
                    autoComplete="email"
                    className="min-w-0 flex-1"
                    aria-invalid={error !== undefined ? true : undefined}
                    aria-describedby={describedBy(
                        blocked && hintId,
                        error !== undefined && errorId,
                    )}
                />
                <LoadingButton
                    type="submit"
                    variant="outline"
                    loading={form.processing}
                    disabled={blocked}
                    className="shrink-0"
                >
                    <Send aria-hidden="true" />
                    {t('Send')}
                </LoadingButton>
            </div>
            {blocked && (
                <p id={hintId} className="text-xs text-muted-foreground">
                    {hint}
                </p>
            )}
            {error !== undefined && (
                <p
                    id={errorId}
                    role="alert"
                    className="flex min-w-0 items-start gap-1.5 text-body-sm text-skrum-destructive-text"
                >
                    <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    <span className="min-w-0">{error}</span>
                </p>
            )}
            {lastTest !== null && resultLine(lastTest)}
        </form>
    );
}
