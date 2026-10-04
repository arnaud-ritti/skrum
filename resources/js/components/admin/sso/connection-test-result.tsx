import { usePage } from '@inertiajs/react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { formatDaysAgo } from '@/lib/relative-date';
import { useTrans } from '@/hooks/use-trans';
import type { SsoLastTest, SsoTestResult } from '@/lib/admin/types';

type ConnectionTestResultProps = {
    /** The test just run (flashed), when it was this provider's. */
    result: SsoTestResult | null;
    /** The last test kept by the instance, when it was this provider's. */
    lastTest: SsoLastTest | null;
};

export function ConnectionTestResult({
    result,
    lastTest,
}: ConnectionTestResultProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    function failure(test: SsoTestResult): string {
        if (test.error === 'not_oidc') {
            return t(
                'The address answers, but not with an OpenID Connect discovery document.',
            );
        }

        if (test.error === 'issuer_mismatch') {
            return t('The provider names another issuer: :issuer.', {
                issuer: test.issuer ?? '',
            });
        }

        return t("The provider's discovery document could not be reached.");
    }

    const shown: SsoTestResult | null =
        result ??
        (lastTest === null
            ? null
            : {
                  ok: lastTest.ok,
                  ms: lastTest.ms,
                  issuer: lastTest.issuer,
                  error: null,
              });

    if (shown === null) {
        return null;
    }

    function failedSentence(test: SsoTestResult): string {
        if (result === null) {
            return t('The last test failed.');
        }

        return failure(test);
    }

    return (
        <div
            data-slot="connection-test-result"
            className="flex min-w-0 flex-col gap-1.5"
        >
            {shown.ok ? (
                <Alert variant="success">
                    <CircleCheck aria-hidden="true" />
                    <span className="min-w-0 break-words">
                        {t('Connected · :ms ms · issuer :issuer', {
                            ms: shown.ms ?? 0,
                            issuer: shown.issuer ?? '',
                        })}
                    </span>
                </Alert>
            ) : (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <span className="min-w-0 break-words">
                        {failedSentence(shown)}
                    </span>
                </Alert>
            )}
            {lastTest !== null && (
                <p className="text-xs text-muted-foreground">
                    {t('Last test :relative at :time', {
                        relative: formatDaysAgo(
                            lastTest.at,
                            locale,
                            Date.now(),
                        ),
                        time: new Intl.DateTimeFormat(locale, {
                            timeStyle: 'short',
                        }).format(new Date(lastTest.at)),
                    })}
                </p>
            )}
        </div>
    );
}
