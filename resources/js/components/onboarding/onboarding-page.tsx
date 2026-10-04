import { Head } from '@inertiajs/react';
import { useState } from 'react';
import { InviteStep } from '@/components/onboarding/invite-step';
import {
    OnboardingProgress,
    OnboardingStepper,
} from '@/components/onboarding/onboarding-header';
import type { OnboardingStepId } from '@/components/onboarding/onboarding-header';
import { RitualStep } from '@/components/onboarding/ritual-step';
import { draftSlug, TeamStep } from '@/components/onboarding/team-step';
import type { TeamDraft } from '@/components/onboarding/team-step';
import { TeamPreview } from '@/components/onboarding/team-preview';
import { WorkspaceStep } from '@/components/onboarding/workspace-step';
import type { LocaleOption } from '@/components/onboarding/workspace-step';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import { shownAddressBase } from '@/lib/teams/team-slug';
import OnboardingLayout from '@/layouts/skrum/onboarding-layout';
import type { TeamRoleValue } from '@/lib/invitations/types';
import type { ColumnColor } from '@/lib/retro/types';

/** 48rem (`md`): below it the stepper leaves the header for the form column. */
const HeaderStepperMinWidth = 768;

/** 80rem (`xl`): from there the header holds every step's name. */
const FullStepperMinWidth = 1280;

export type OnboardingProps = {
    step: OnboardingStepId;
    workspace: { name: string; slug: string; locale: string | null } | null;
    team: {
        id: string;
        name: string;
        slug: string;
        color: ColumnColor;
        description: string | null;
    } | null;
    /** The instance's address followed by "/t/". */
    teamAddressBase: string;
    /** The team name given at registration, until the team exists. */
    teamName: string | null;
    defaultColor: ColumnColor;
    /** Not `locales`: that shared prop is the language switcher's. */
    languages: LocaleOption[];
    userLocale: string;
    inviteRoles: TeamRoleValue[];
    invitedCount: number;
    inviteLinkUrl: string | null;
    inviteLinkExpiresInDays: number;
    inviteLinkUsesCount: number;
    hasHadInviteLink: boolean;
    membersCount: number;
    /** False once the account joined the instance's default workspace (P25-15): step 1 is done and "Back" is not offered. */
    canEditWorkspace: boolean;
};

/** The address as ScreenOnboarding draws it: no scheme. */
function teamDraftFrom(props: OnboardingProps): TeamDraft {
    return {
        name: props.team?.name ?? props.teamName ?? '',
        color: props.team?.color ?? props.defaultColor,
        slug: props.team?.slug ?? '',
        slugEdited: props.team !== null,
        description: props.team?.description ?? '',
    };
}

/**
 * The four-step onboarding (ScreenOnboarding a and c): the stepper in the
 * header, the progress under it, the current step's form and, from `lg`,
 * the live preview of the team.
 */
export function OnboardingPage(props: OnboardingProps) {
    const { t } = useTrans();
    const { step, workspace, team } = props;
    const headerStepper = useMinWidth(HeaderStepperMinWidth);
    const fullStepper = useMinWidth(FullStepperMinWidth);
    const addressBase = shownAddressBase(props.teamAddressBase);
    const [workspaceName, setWorkspaceName] = useState(workspace?.name ?? '');
    const [draft, setDraft] = useState(() => teamDraftFrom(props));
    const [draftStep, setDraftStep] = useState(step);

    if (draftStep !== step) {
        setDraftStep(step);

        if (step === 'team') {
            setDraft(teamDraftFrom(props));
        }

        if (step === 'workspace') {
            setWorkspaceName(workspace?.name ?? '');
        }
    }

    const previewTeam =
        step === 'workspace' || step === 'team' || team === null
            ? {
                  name: draft.name,
                  color: draft.color,
                  address: `${addressBase}${draftSlug(draft)}`,
              }
            : {
                  name: team.name,
                  color: team.color,
                  address: `${addressBase}${team.slug}`,
              };
    const previewWorkspace =
        step === 'workspace' ? workspaceName : (workspace?.name ?? '');

    return (
        <OnboardingLayout
            stepper={
                headerStepper ? (
                    <OnboardingStepper step={step} mobile={!fullStepper} />
                ) : undefined
            }
            progress={<OnboardingProgress step={step} />}
            aside={
                <TeamPreview
                    step={step}
                    team={previewTeam}
                    workspaceName={previewWorkspace}
                    membersCount={props.membersCount}
                    invitedCount={props.invitedCount}
                />
            }
        >
            <Head title={t('Getting started')} />
            <div
                data-slot="onboarding-form"
                className="flex w-full max-w-180 min-w-0 flex-1 flex-col gap-5 px-4 pt-6 md:px-10 md:py-12 xl:pr-16 xl:pl-24"
            >
                {!headerStepper && <OnboardingStepper step={step} mobile />}
                {step === 'workspace' && (
                    <WorkspaceStep
                        workspace={workspace}
                        locales={props.languages}
                        userLocale={props.userLocale}
                        name={workspaceName}
                        onNameChange={setWorkspaceName}
                    />
                )}
                {step === 'team' && (
                    <TeamStep
                        draft={draft}
                        onDraftChange={setDraft}
                        addressBase={addressBase}
                        workspaceName={workspace?.name ?? ''}
                        canGoBack={props.canEditWorkspace}
                    />
                )}
                {step === 'invite' && team !== null && workspace !== null && (
                    <InviteStep
                        workspaceSlug={workspace.slug}
                        team={team}
                        roles={props.inviteRoles}
                        hadLink={props.hasHadInviteLink}
                        link={
                            props.inviteLinkUrl === null
                                ? null
                                : {
                                      url: props.inviteLinkUrl,
                                      expiresInDays:
                                          props.inviteLinkExpiresInDays,
                                      usesCount: props.inviteLinkUsesCount,
                                  }
                        }
                    />
                )}
                {step === 'ritual' && <RitualStep />}
            </div>
        </OnboardingLayout>
    );
}
