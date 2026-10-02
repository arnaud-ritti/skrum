import { Building2, Github, KeyRound } from 'lucide-react';
import type { ReactNode } from 'react';
import SsoRedirectsController from '@/actions/App/Http/Controllers/SsoRedirectsController';
import { AuthSeparator } from '@/components/auth/auth-separator';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { SsoProviderKey, SsoProviderOption } from '@/types';

const marks: Record<SsoProviderKey, ReactNode> = {
    oidc: <KeyRound aria-hidden />,
    entra: <Building2 aria-hidden />,
    github: <Github aria-hidden />,
    google: (
        <span
            aria-hidden
            className="w-4 shrink-0 text-center font-display text-base/none font-extrabold"
        >
            G
        </span>
    ),
};

function redirectUrl(provider: SsoProviderOption): string {
    return SsoRedirectsController.show.url({ provider: provider.key });
}

export function SsoButtons({ providers }: { providers: SsoProviderOption[] }) {
    const { t } = useTrans();

    if (providers.length === 0) {
        return null;
    }

    const [first, ...others] = providers;

    return (
        <div data-slot="sso-buttons" className="flex min-w-0 flex-col gap-4">
            <Button variant="outline" size="lg" className="w-full" asChild>
                <a href={redirectUrl(first)}>
                    {marks[first.key]}
                    <span className="truncate">
                        {t('Continue with :provider', {
                            provider: first.label,
                        })}
                    </span>
                </a>
            </Button>
            {others.length > 0 && (
                <div
                    data-slot="sso-buttons-more"
                    className="grid gap-2 sm:grid-cols-2"
                >
                    {others.map((provider) => (
                        <Button
                            key={provider.key}
                            variant="outline"
                            className="w-full min-w-0 sm:last:odd:col-span-2"
                            asChild
                        >
                            <a
                                href={redirectUrl(provider)}
                                aria-label={t('Continue with :provider', {
                                    provider: provider.label,
                                })}
                            >
                                {marks[provider.key]}
                                <span className="truncate">
                                    {provider.label}
                                </span>
                            </a>
                        </Button>
                    ))}
                </div>
            )}
            {/* A passkey button placed right after carries the separator itself. */}
            <AuthSeparator
                label={t('or with your e-mail')}
                className="in-[[data-slot=sso-buttons]:has(+[data-slot=passkey-sign-in])]:hidden"
            />
        </div>
    );
}
