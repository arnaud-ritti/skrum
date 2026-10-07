import { BookOpen, Code, Coffee, ExternalLink, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { projectLinks } from '@/lib/project-links';

export type AvatarStyleAttribution = {
    style: string;
    name: string;
    source: string;
    creator: string;
    license: string;
    sourceUrl: string | null;
};

export type AboutContentProps = {
    name: string;
    version: string;
    poweredBy: boolean;
    attributions: {
        avatarStyles: AvatarStyleAttribution[];
        gifProvider: 'giphy' | 'tenor' | null;
    };
};

const gifProviderNames = { giphy: 'GIPHY', tenor: 'Tenor' } as const;

function AttributionRow({
    attribution,
}: {
    attribution: AvatarStyleAttribution;
}) {
    const { t } = useTrans();

    return (
        <li
            data-slot="about-attribution"
            className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-3 last:border-b-0"
        >
            <div className="flex min-w-40 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                    {attribution.name}
                </span>
                <span className="text-body-sm text-muted-foreground">
                    {t(':source by :creator', {
                        source: attribution.source,
                        creator: attribution.creator,
                    })}
                </span>
            </div>
            <Badge variant="muted" className="max-w-full">
                <span className="truncate">{attribution.license}</span>
            </Badge>
            {attribution.sourceUrl !== null && (
                <a
                    href={attribution.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={t('Source of :name (opens in a new tab)', {
                        name: attribution.name,
                    })}
                    className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium text-skrum-primary-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <span className="truncate">{t('Source')}</span>
                    <ExternalLink
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                </a>
            )}
        </li>
    );
}

export function AboutContent({
    name,
    version,
    poweredBy,
    attributions,
}: AboutContentProps) {
    const { t } = useTrans();
    const { avatarStyles, gifProvider } = attributions;

    return (
        <div
            data-slot="about"
            className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6"
        >
            <header className="flex min-w-0 flex-col gap-1">
                <h1 className="font-display text-2xl font-bold break-words">
                    {name}
                </h1>
                <p
                    data-slot="about-version"
                    className="text-sm text-muted-foreground"
                >
                    {t('Version :version', { version })}
                </p>
                {poweredBy && (
                    <p
                        data-slot="about-powered-by"
                        className="text-sm text-muted-foreground"
                    >
                        {t('Powered by Skrüm')}
                    </p>
                )}
            </header>
            <p className="text-base leading-relaxed text-muted-foreground">
                {t(
                    'Skrüm brings your team together for retrospectives, planning poker, icebreakers and surveys.',
                )}
            </p>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('Explore Skrüm')}</h2>
                    </CardTitle>
                    <CardDescription>
                        {t(
                            'Open source under the GNU Affero General Public License v3.0 or later; every feature is included.',
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                        <a
                            href={projectLinks.documentation}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <BookOpen aria-hidden="true" />
                            {t('Documentation')}
                        </a>
                    </Button>
                    <Button asChild variant="outline">
                        <a
                            href={projectLinks.repository}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <Code aria-hidden="true" />
                            {t('Source code')}
                        </a>
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('Support Skrüm')}</h2>
                    </CardTitle>
                    <CardDescription>
                        {t(
                            'Help Arnaud Ritti keep building and maintaining Skrüm.',
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button asChild variant="outline">
                        <a
                            href={projectLinks.sponsors}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <Heart aria-hidden="true" />
                            GitHub Sponsors
                        </a>
                    </Button>
                    <Button asChild variant="outline">
                        <a
                            href={projectLinks.koFi}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            <Coffee aria-hidden="true" />
                            Ko-fi
                        </a>
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2>{t('Avatar styles')}</h2>
                    </CardTitle>
                    <CardDescription>
                        {t(
                            'Avatars are drawn with DiceBear. Some styles ask that their author be credited.',
                        )}
                    </CardDescription>
                </CardHeader>
                {avatarStyles.length === 0 ? (
                    <CardContent>
                        <p
                            data-slot="about-attributions-empty"
                            className="text-sm text-muted-foreground"
                        >
                            {t('The avatar style in use needs no attribution.')}
                        </p>
                    </CardContent>
                ) : (
                    <ul className="mt-3 min-w-0 border-t">
                        {avatarStyles.map((attribution) => (
                            <AttributionRow
                                key={attribution.style}
                                attribution={attribution}
                            />
                        ))}
                    </ul>
                )}
            </Card>
            {gifProvider !== null && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h2>{t('GIFs')}</h2>
                        </CardTitle>
                        <CardDescription data-slot="about-gif-provider">
                            {t('Powered by :provider', {
                                provider: gifProviderNames[gifProvider],
                            })}
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
    );
}
