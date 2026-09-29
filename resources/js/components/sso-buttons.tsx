import SsoRedirectsController from '@/actions/App/Http/Controllers/SsoRedirectsController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { SsoProviderOption } from '@/types';

export function SsoButtons({ providers }: { providers: SsoProviderOption[] }) {
    const { t } = useTrans();

    if (providers.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground uppercase">
                <span className="h-px flex-1 bg-border" />
                {t('or')}
                <span className="h-px flex-1 bg-border" />
            </div>
            {providers.map((provider) => (
                <Button
                    key={provider.key}
                    variant="outline"
                    className="w-full"
                    asChild
                >
                    <a
                        href={SsoRedirectsController.show.url({
                            provider: provider.key,
                        })}
                    >
                        {t('Continue with :provider', {
                            provider: provider.label,
                        })}
                    </a>
                </Button>
            ))}
        </div>
    );
}
