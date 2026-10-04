import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import InputError from '@/components/input-error';
import { SettingsCard } from '@/components/settings/settings-card';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TeamAddressField } from '@/components/skrum/team-address-field';
import { TeamSettingsCard } from '@/components/teams/team-settings-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { shownAddressBase } from '@/lib/teams/team-slug';
import type { TeamSummary } from '@/types';

/** `TeamsController::update`: the limits of the two fields. */
const NameMaxLength = 100;
const DescriptionMaxLength = 200;

type GeneralSettingsProps = {
    workspaceSlug: string;
    team: TeamSummary & { description?: string | null };
    canDelete: boolean;
};

type TeamDetails = { name: string; description: string; slug?: string };

/** The instance's address and `/t/`, the part of the team address before its slug. */
function addressBase(address: string, slug: string): string {
    const base = address.endsWith(slug)
        ? address.slice(0, address.length - slug.length)
        : address;

    return shownAddressBase(base);
}

/** The General tab: the Team card, then the danger zone for who may delete. */
export function GeneralSettings({
    workspaceSlug,
    team,
    canDelete,
}: GeneralSettingsProps): ReactElement {
    const { t } = useTrans();
    const helpId = useId();
    const nameErrorId = useId();
    const descriptionErrorId = useId();
    const [details, setDetails] = useState<TeamDetails>({
        name: team.name,
        description: team.description ?? '',
        ...(team.slug === undefined ? {} : { slug: team.slug }),
    });
    const [errors, setErrors] = useState<Partial<TeamDetails>>({});
    const [saving, setSaving] = useState(false);

    const save = (event: FormEvent<HTMLFormElement>): void => {
        event.preventDefault();

        if (saving) {
            return;
        }

        router.patch(
            TeamsController.update.url({
                workspace: workspaceSlug,
                team: team.id,
            }),
            details,
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onSuccess: () => setErrors({}),
                onError: (failures) =>
                    setErrors({
                        name: failures.name,
                        description: failures.description,
                        slug: failures.slug,
                    }),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <>
            <form onSubmit={save} className="min-w-0" noValidate>
                <SettingsCard
                    title={t('Team')}
                    footer={
                        <LoadingButton
                            type="submit"
                            size="sm"
                            loading={saving}
                            className="max-w-full"
                        >
                            <span className="truncate">{t('Save')}</span>
                        </LoadingButton>
                    }
                >
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label htmlFor="team-name">{t('Name')}</Label>
                        <Input
                            id="team-name"
                            name="name"
                            value={details.name}
                            onChange={(event) =>
                                setDetails({
                                    ...details,
                                    name: event.target.value,
                                })
                            }
                            required
                            maxLength={NameMaxLength}
                            aria-invalid={errors.name ? true : undefined}
                            aria-describedby={
                                errors.name ? nameErrorId : undefined
                            }
                        />
                        <InputError id={nameErrorId} message={errors.name} />
                    </div>
                    {details.slug !== undefined &&
                        team.slug !== undefined &&
                        team.address !== undefined && (
                            <TeamAddressField
                                id="team-slug"
                                base={addressBase(team.address, team.slug)}
                                slug={details.slug}
                                name={details.name}
                                isEdited
                                onChange={(slug) =>
                                    setDetails({ ...details, slug })
                                }
                                error={errors.slug}
                            />
                        )}
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <Label htmlFor="team-description">
                            {t('Description')}
                        </Label>
                        <Textarea
                            id="team-description"
                            name="description"
                            rows={3}
                            value={details.description}
                            onChange={(event) =>
                                setDetails({
                                    ...details,
                                    description: event.target.value,
                                })
                            }
                            maxLength={DescriptionMaxLength}
                            aria-invalid={errors.description ? true : undefined}
                            aria-describedby={
                                errors.description
                                    ? `${descriptionErrorId} ${helpId}`
                                    : helpId
                            }
                        />
                        <InputError
                            id={descriptionErrorId}
                            message={errors.description}
                        />
                        <p
                            id={helpId}
                            className="text-body-sm text-muted-foreground"
                        >
                            {t('Shown on the workspace page.')}
                        </p>
                    </div>
                </SettingsCard>
            </form>
            {canDelete && (
                <TeamSettingsCard workspaceSlug={workspaceSlug} team={team} />
            )}
        </>
    );
}
