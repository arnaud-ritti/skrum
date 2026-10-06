---
title: "Health check, pulse and eNPS"
description: "The three ready-made surveys: what each one asks and how its score is computed."
order: 2
related:
  - surveys/create-a-survey
  - surveys/results
  - insights/health-and-enps-trends
---

When you [create a survey](../create-a-survey/), **Start from** offers three ready-made surveys beside **Blank**: **Health check**, **Team pulse** and **eNPS**. This page lists the questions of each and says how its figures are computed.

![The New session dialog on the Poll type: Start from offers Blank, Health check with 6 statements, Team pulse with 5 questions, eNPS with 3 questions and A previous survey](../../../assets/screenshots/surveys/template-choice.png)

The questions of **Team pulse** and **eNPS** are written into the survey in the language of the person who creates it, and can be edited in the builder like any other question. The built-in statements of a **Health check** are shown to each person in their own language.

## Health check

A health check has one required question per active statement of the team, each scored on a scale from 1, **Strongly disagree**, to 5, **Strongly agree**. A team that has not changed its statements has these six:

1. Interaction with colleagues was productive
2. Tasks assigned to me were clear
3. My manager was understanding and supportive
4. The vision and goals are clear to me
5. Our processes let me work without blockers
6. I felt motivated in my work

The questions cannot be edited in the builder, which says **The questions of a health check come from the team's statements.** Its **Manage statements** button opens the team's **Health check** page; see [Health and eNPS trends](../../insights/health-and-enps-trends/).

**Score.** The results give each statement its average out of 5, rounded to one decimal, and its most frequent answer. Once closed, a health check that has answers becomes a point of the **Mood trend** on the team's **Health check** page.

A health check is compared by default with the team's previous closed health check, whether or not it was duplicated from it.

## Team pulse

Five questions about the sprint.

| Question | Kind | Required |
|---|---|---|
| How do you rate the workload of this sprint? | **Scale 1 – 5**, from **Unbearable** to **Very comfortable** | Yes |
| Would you recommend this team to a developer friend? | **NPS** | Yes |
| Which ritual should we keep at all costs? | **Single choice**: Retrospective, Daily, Planning poker, Sprint review | No |
| What slowed you down this sprint? | **Multiple choice**: Too many meetings, Dependency on another team, Test environment, Unclear specifications, Something else | No |
| A word for the team? | **Free text** | No |

The first two questions also take an optional comment, under **Why this score? (optional)**.

**Score.** There is no single score: the scale gives an average out of 5, the NPS question a score computed as for the eNPS below, and each option the number and the share of the people who chose it.

## eNPS

Three questions.

| Question | Kind | Required |
|---|---|---|
| How likely are you to recommend working in this team to a friend or colleague? | **NPS** | Yes |
| How likely are you to recommend our company as a place to work? | **NPS** | Yes |
| What is the main reason for your scores? | **Free text** | No |

**Score.** Each NPS question is answered from 0 to 10 and gets its own score:

- people who answer 9 or 10 are promoters, 7 or 8 passives, 0 to 6 detractors;
- the score is the percentage of promoters minus the percentage of detractors, among the people who answered the question, rounded to a whole number. It goes from −100 to +100.

With seven answers of which four are promoters and one is a detractor, the score is 57 − 14 = +43.

The team's eNPS page follows the score of the first question, the one about the team, across the eNPS surveys that are closed and reached three answers; see [Health and eNPS trends](../../insights/health-and-enps-trends/).
