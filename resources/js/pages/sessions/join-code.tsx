import { Form, Head } from '@inertiajs/react';
import JoinCodesController from '@/actions/App/Http/Controllers/JoinCodesController';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function JoinCode() {
    const { t } = useTrans();

    return (
        <AuthLayout title={t('Join a session')} literalTitle variant="centered">
            <Head title={t('Join a session')} />
            <Form
                {...JoinCodesController.store.form()}
                className="flex min-w-0 flex-col gap-4"
            >
                {({ processing, errors }) => (
                    <>
                        <TextField
                            id="code"
                            name="code"
                            label={t('Session code')}
                            required
                            autoFocus
                            autoComplete="off"
                            autoCapitalize="characters"
                            placeholder="ABC-1234"
                            error={errors.code}
                            className="font-mono uppercase max-md:h-12"
                        />

                        <LoadingButton
                            type="submit"
                            size="lg"
                            className="w-full"
                            loading={processing}
                        >
                            <span className="truncate">{t('Continue')}</span>
                        </LoadingButton>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
