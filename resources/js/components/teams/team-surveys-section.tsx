import { router, usePage } from '@inertiajs/react';
import { ChartColumn, Copy, Ellipsis, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import TeamSurveyDuplicatesController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveyDuplicatesController';
import TeamSurveysController from '@/actions/App/Http/Controllers/TeamSurveys/TeamSurveysController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { EmptyState } from '@/components/skrum/empty-state';
import { SessionCard } from '@/components/skrum/session-card';
import type {
    SessionCardStatus,
    SessionCardStatusTone,
} from '@/components/skrum/session-card';
import { TeamSection } from '@/components/teams/team-section';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type { SurveyStatus, TeamSurveySummary } from '@/lib/surveys/types';

type Props = {
    workspaceSlug: string;
    teamId: string;
    surveys: TeamSurveySummary[];
    canCreateSurvey: boolean;
};

const StatusCards: Record<
    SurveyStatus,
    { status: SessionCardStatus; tone: SessionCardStatusTone }
> = {
    draft: { status: 'scheduled', tone: 'muted' },
    open: { status: 'live', tone: 'success' },
    closed: { status: 'ended', tone: 'muted' },
};

export function TeamSurveysSection({
    workspaceSlug,
    teamId,
    surveys,
    canCreateSurvey,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [deleting, setDeleting] = useState<TeamSurveySummary | null>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const deletedId = useRef<string | null>(null);
    const afterMenuClose = useRef<(() => void) | null>(null);
    const formatDate = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
    });
    const statusLabels: Record<SurveyStatus, string> = {
        draft: t('Draft'),
        open: t('Open'),
        closed: t('Closed'),
    };
    const templateLabels: Record<string, string> = {
        health_check: t('Health check'),
        team_pulse: t('Team pulse'),
    };

    // The menu that opened the dialog leaves with its card: the focus goes to
    // the heading of the section once the reloaded list no longer holds it.
    useEffect(() => {
        if (deletedId.current === null) {
            return;
        }

        if (surveys.some((survey) => survey.id === deletedId.current)) {
            return;
        }

        deletedId.current = null;
        headingRef.current?.focus();
    }, [surveys]);

    const leaveDeletedSurvey = (survey: TeamSurveySummary): void => {
        deletedId.current = survey.id;
        router.reload({ only: ['surveys'] });
    };

    const destroy = async (): Promise<void> => {
        if (deleting === null) {
            return;
        }

        try {
            await retroRequest(TeamSurveysController.destroy(deleting.id));
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 404) {
                leaveDeletedSurvey(deleting);

                return;
            }

            toast.error(
                error instanceof RetroRequestError && error.status > 0
                    ? error.message
                    : t('Something went wrong. Please try again.'),
            );

            throw error;
        }

        leaveDeletedSurvey(deleting);
    };

    const duplicate = (survey: TeamSurveySummary): void => {
        router.post(
            TeamSurveyDuplicatesController.store(survey.id).url,
            {},
            { preserveScroll: true },
        );
    };

    const countsOf = (survey: TeamSurveySummary): string => {
        const answers =
            survey.responseCount === 1
                ? t('1 answer')
                : t(':count answers', { count: survey.responseCount });
        const questions =
            survey.questionCount === 1
                ? t('1 question')
                : t(':count questions', { count: survey.questionCount });

        return `${answers} · ${questions}`;
    };

    const dateOf = (survey: TeamSurveySummary): string => {
        const date = survey.closedAt ?? survey.updatedAt;

        return date === null ? '' : formatDate.format(new Date(date));
    };

    return (
        <TeamSection
            id="surveys"
            icon={ChartColumn}
            title={t('Surveys')}
            count={surveys.length}
            headingRef={headingRef}
        >
            {surveys.length === 0 && (
                <Card className="border-dashed shadow-none">
                    <EmptyState
                        module="survey"
                        headingLevel="h3"
                        illustration={false}
                        title={t('No survey published')}
                        description={t(
                            'Measure morale or psychological safety in 2 minutes, anonymously.',
                        )}
                        action={
                            canCreateSurvey
                                ? {
                                      label: t('Create a survey'),
                                      icon: Plus,
                                      href: TeamsController.show(
                                          {
                                              workspace: workspaceSlug,
                                              team: teamId,
                                          },
                                          { query: { new: 'survey' } },
                                      ),
                                  }
                                : undefined
                        }
                        className="py-6"
                    />
                </Card>
            )}
            {surveys.length > 0 && (
                <ul
                    data-slot="team-surveys"
                    className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3"
                >
                    {surveys.map((survey) => {
                        const card = StatusCards[survey.status];
                        const hasMenu = canCreateSurvey || survey.canManage;

                        return (
                            <li
                                key={survey.id}
                                data-test="survey-card"
                                className="flex min-w-0"
                            >
                                <SessionCard
                                    className="w-full"
                                    href={survey.url}
                                    kind="survey"
                                    title={survey.title}
                                    team={
                                        templateLabels[survey.template ?? ''] ??
                                        t('Survey')
                                    }
                                    when={dateOf(survey)}
                                    status={card.status}
                                    statusLabel={statusLabels[survey.status]}
                                    statusTone={card.tone}
                                    meta={
                                        <span
                                            data-slot="survey-counts"
                                            className="whitespace-nowrap"
                                        >
                                            {countsOf(survey)}
                                        </span>
                                    }
                                    action={
                                        hasMenu ? (
                                            <SurveyMenu
                                                canDuplicate={canCreateSurvey}
                                                canDelete={survey.canManage}
                                                onDuplicate={() =>
                                                    duplicate(survey)
                                                }
                                                onDelete={() => {
                                                    afterMenuClose.current =
                                                        () =>
                                                            setDeleting(survey);
                                                }}
                                                afterMenuClose={afterMenuClose}
                                            />
                                        ) : undefined
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleting(null);
                    }
                }}
                tone="destructive"
                title={t('Delete this survey?')}
                description={t('Its questions and answers are deleted too.')}
                confirmLabel={t('Delete')}
                onConfirm={destroy}
            />
        </TeamSection>
    );
}

function SurveyMenu({
    canDuplicate,
    canDelete,
    onDuplicate,
    onDelete,
    afterMenuClose,
}: {
    canDuplicate: boolean;
    canDelete: boolean;
    onDuplicate: () => void;
    onDelete: () => void;
    afterMenuClose: { current: (() => void) | null };
}) {
    const { t } = useTrans();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('Survey actions')}
                >
                    <Ellipsis aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            {/*
              A dialog gives the keyboard back to what had it at its opening:
              opened from an entry, that is the entry, gone with the menu. It
              opens once the menu has handed the keyboard back to its button.
            */}
            <DropdownMenuContent
                align="end"
                onCloseAutoFocus={() => {
                    const open = afterMenuClose.current;

                    afterMenuClose.current = null;
                    open?.();
                }}
            >
                {canDuplicate && (
                    <DropdownMenuItem onSelect={onDuplicate}>
                        <Copy aria-hidden />
                        <span className="truncate">{t('Duplicate')}</span>
                    </DropdownMenuItem>
                )}
                {canDuplicate && canDelete && <DropdownMenuSeparator />}
                {canDelete && (
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        <Trash2 aria-hidden />
                        <span className="truncate">{t('Delete')}</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
