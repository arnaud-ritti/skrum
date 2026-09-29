import { Form, Head, Link } from '@inertiajs/react';
import InvitationAcceptancesController from '@/actions/App/Http/Controllers/InvitationAcceptancesController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { login, register } from '@/routes';

type Props = {
    token: string;
    workspaceName: string;
    email: string;
    isExpired: boolean;
    isLoggedIn: boolean;
    emailMatches: boolean;
    canRegister: boolean;
};

export default function ShowInvitation({
    token,
    workspaceName,
    email,
    isExpired,
    isLoggedIn,
    emailMatches,
    canRegister,
}: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Invitation')} />
            <div className="space-y-6">
                <Heading
                    title={t('Join :workspace', { workspace: workspaceName })}
                    description={t('This invitation was sent to :email.', {
                        email,
                    })}
                />

                {isExpired && (
                    <p className="text-destructive">
                        {t('This invitation has expired or was already used.')}
                    </p>
                )}

                {!isExpired && isLoggedIn && emailMatches && (
                    <Form
                        {...InvitationAcceptancesController.store.form(token)}
                    >
                        {({ processing }) => (
                            <Button disabled={processing}>
                                {t('Accept invitation')}
                            </Button>
                        )}
                    </Form>
                )}

                {!isExpired && isLoggedIn && !emailMatches && (
                    <p className="text-destructive">
                        {t(
                            'You are logged in with another email address. Log out and sign in as :email to accept.',
                            { email },
                        )}
                    </p>
                )}

                {!isExpired && !isLoggedIn && (
                    <div className="flex gap-3">
                        <Button asChild>
                            <Link href={login()}>{t('Log in')}</Link>
                        </Button>
                        {canRegister && (
                            <Button variant="outline" asChild>
                                <Link href={register()}>
                                    {t('Create an account')}
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
