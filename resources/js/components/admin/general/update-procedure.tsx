import { Check, ChevronDown, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';

const Methods = ['compose', 'coolify', 'source'] as const;
const VersionPlaceholder = '<version>';

type Method = (typeof Methods)[number];

type Step = { text: string; command?: string };

type UpdateProcedureProps = {
    /** The published image, without its tag. */
    image: string;
    /** The version to move to; null while no newer one is known. */
    version: string | null;
    defaultOpen: boolean;
};

function Command({
    command,
    copied,
    onCopy,
}: {
    command: string;
    copied: boolean;
    onCopy: (command: string) => void;
}) {
    const { t } = useTrans();

    return (
        <div className="mt-1.5 flex min-w-0 items-start gap-2">
            <pre
                data-slot="update-command"
                className="min-w-0 flex-1 rounded-md border bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap"
            >
                {command}
            </pre>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => onCopy(command)}
            >
                {copied ? (
                    <Check aria-hidden="true" />
                ) : (
                    <Copy aria-hidden="true" />
                )}
                <span>{copied ? t('Copied') : t('Copy')}</span>
            </Button>
        </div>
    );
}

/** How to move the instance to a newer version, for each kind of install. */
export function UpdateProcedure({
    image,
    version,
    defaultOpen,
}: UpdateProcedureProps) {
    const { t } = useTrans();
    const [copied, copy] = useClipboard();
    const target = version ?? VersionPlaceholder;
    const labels: Record<Method, string> = {
        compose: 'Docker Compose',
        coolify: 'Coolify',
        source: t('From source'),
    };
    const steps: Record<Method, Step[]> = {
        compose: [
            { text: t('Back up the database and the app-storage volume.') },
            {
                text: t(
                    'If SKRUM_IMAGE pins a version in your .env file, set it to the new one.',
                ),
                command: `SKRUM_IMAGE=${image}:${target}`,
            },
            {
                text: t(
                    'Pull the image and recreate the containers. Use the name of your own Compose file if it differs.',
                ),
                command:
                    'docker compose -f compose.production.yaml pull && docker compose -f compose.production.yaml up -d',
            },
            {
                text: t(
                    'Migrations run by themselves when the container starts. Reload this page: the version above is the new one.',
                ),
            },
        ],
        coolify: [
            { text: t('Back up the database and the storage volume.') },
            {
                text: t(
                    'In the service, edit the Compose file and set the image to the new version.',
                ),
                command: `${image}:${target}`,
            },
            {
                text: t(
                    'Press Deploy. Migrations run by themselves when the container starts.',
                ),
            },
            {
                text: t('Reload this page: the version above is the new one.'),
            },
        ],
        source: [
            { text: t('Back up the database and the storage/app directory.') },
            {
                text: t('Fetch the new version.'),
                command: `git fetch --tags && git checkout v${target}`,
            },
            {
                text: t('Install the dependencies and build the interface.'),
                command:
                    'composer install --no-dev --optimize-autoloader && npm ci && npm run build',
            },
            {
                text: t('Run the migrations and rebuild the caches.'),
                command: 'php artisan migrate --force && php artisan optimize',
            },
            {
                text: t(
                    'Restart the web server, the queue worker, Reverb and the scheduler.',
                ),
            },
        ],
    };

    async function copyCommand(command: string): Promise<void> {
        if (!(await copy(command))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    }

    return (
        <Collapsible defaultOpen={defaultOpen} data-slot="update-procedure">
            <CollapsibleTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="group -ml-2 max-w-full gap-1.5 text-muted-foreground"
                >
                    <span className="truncate">{t('How to update')}</span>
                    <ChevronDown
                        aria-hidden="true"
                        className="transition-transform group-data-[state=open]:rotate-180"
                    />
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <Tabs<Method> defaultValue="compose" className="mt-2 gap-3">
                    <TabsList aria-label={t('Kind of install')}>
                        {Methods.map((method) => (
                            <TabsTrigger key={method} value={method}>
                                {labels[method]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    {Methods.map((method) => (
                        <TabsContent key={method} value={method}>
                            <ol className="flex min-w-0 list-decimal flex-col gap-3 pl-5 text-body-sm">
                                {steps[method].map((step) => (
                                    <li key={step.text} className="min-w-0">
                                        <p>{step.text}</p>
                                        {step.command !== undefined && (
                                            <Command
                                                command={step.command}
                                                copied={copied === step.command}
                                                onCopy={(command) =>
                                                    void copyCommand(command)
                                                }
                                            />
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </TabsContent>
                    ))}
                </Tabs>
            </CollapsibleContent>
        </Collapsible>
    );
}
