import { Form, Head } from '@inertiajs/react';
import CodeConfirmationsController from '@/actions/App/Http/Controllers/Settings/CodeConfirmationsController';
import { BrandAside } from '@/components/auth/brand-aside';
import { ConfirmPasswordForm } from '@/components/auth/confirm-password-form';
import { EmailCodeConfirmation } from '@/components/auth/email-code-confirmation';
import { LoadingButton } from '@/components/skrum/loading-button';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ConfirmPassword({
    confirmsWith,
}: {
    /** An account whose owner knows no password confirms with a code sent by e-mail. */
    confirmsWith: 'password' | 'code';
}) {
    const { t } = useTrans();
    const title =
        confirmsWith === 'code'
            ? t('Confirm it is you')
            : t('Confirm password');

    return (
        <AuthLayout
            title={title}
            description={
                confirmsWith === 'code'
                    ? t(
                          'This is a secure area of the application. Enter the code we email you before continuing.',
                      )
                    : t(
                          'This is a secure area of the application. Please confirm your password before continuing.',
                      )
            }
            aside={<BrandAside />}
        >
            <Head title={title} />
            {confirmsWith === 'code' ? (
                <Form
                    {...CodeConfirmationsController.store.form()}
                    className="flex min-w-0 flex-col gap-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <EmailCodeConfirmation
                                error={errors.code}
                                processing={processing}
                            />
                            <LoadingButton
                                type="submit"
                                size="lg"
                                className="w-full"
                                loading={processing}
                                data-test="confirm-code-button"
                            >
                                <span className="truncate">{t('Confirm')}</span>
                            </LoadingButton>
                        </>
                    )}
                </Form>
            ) : (
                <ConfirmPasswordForm />
            )}
        </AuthLayout>
    );
}
