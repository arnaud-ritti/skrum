# Coverage: surveys and health check

Date: 2026-10-04. Branch `tests/coverage-surveys`. Spec: `docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` (plan 19). No roadmap spec of plans 20 to 29 adds a survey criterion.

New browser file: `tests/Browser/Walkthroughs/CoverageSurveysTest.php` (CVS-01 to CVS-16). The other files are:

- `Plan19TeamSurveysTest.php` (P19w)
- `SurveyPagesVisualTest.php` (P19-31, eight configurations each: light and dark, English and French, 1440 and 390)
- `Plan08bHealthCheckTest.php` (P08b)
- `Plan08cSurveysTest.php` (P08c)
- `Plan08dResultsTest.php` (P08d)

## Routes

| Route | Kind | Renders for the right person | Refused for the wrong person |
| --- | --- | --- | --- |
| `GET surveys/{teamSurvey}/edit` (`surveys.edit`) | page | P19w-01, 02, 03, 11, 15, 17; CVS-11, 12, 13; P19-31-01, 02 | CVS-01: member 403, guest 403, visitor to login |
| `GET surveys/{teamSurvey}` (`surveys.show`) | page | P19w-04, 05, 06, 12, 14; CVS-04 (observer, read only); P19-31-03 | CVS-02: draft 403 for a non-editor, editor sent to the builder. CVS-03: outsider 403, visitor to login or to "session ended". CVS-07: guest whose link was replaced. CVS-08: attached health check sent to its retro |
| `GET surveys/{teamSurvey}/results` (`surveys.results.show`) | page | P19w-05, 07, 08, 09, 13, 16; CVS-05 (guest), 14, 15; P19-31-04, 05 | CVS-02 (draft), CVS-03 (outsider, visitor), CVS-08 (attached) |
| `GET surveys/join/{guestToken}` (`surveys.join.show`) | page | P19w-06; CVS-01, 05, 07; P19-31-06 | CVS-06: unknown link, guests off, draft; a member with the survey is sent to it. CVS-07: replaced link |
| `GET w/{workspace}/teams/{team}/health-check` (`teams.healthCheck.show`) | page | P19w-11; P08b-01a, 01b, 07; CVS-09 (observer), CVS-16; P19-31-08 | CVS-09: workspace member outside the team 403, other workspace 404, visitor to login |
| `GET surveys/{teamSurvey}/snapshot` | JSON | feature tests: `TeamSurveyAccessTest`, `TeamSurveyRolesTest`, `TeamSurveyResultsTest`, `TeamSurveyJoinTest` | feature tests: `TeamSurveyRolesTest` (another workspace), `TeamSurveyAccessTest` (401, attached 404) |
| `GET surveys/{teamSurvey}/comparison` | JSON | feature test: `CompareSurveysTest`; browser: P19w-08, CVS-14 | feature tests: `CompareSurveysTest`, `TeamSurveyRolesTest` |
| `GET surveys/{teamSurvey}/export` | CSV | feature test: `TeamSurveyExportTest`; browser: P19w-09 | feature tests: `TeamSurveyExportTest`, `TeamSurveyRolesTest`; browser: P19w-09 (no link for a member) |
| `GET retros/{retro}/surveys/{survey}` (`retros.surveys.show`) | JSON | feature tests: `Retros/SurveysTest`, `SurveyDiscussionTest`; browser: P08c | feature test: `Retros/SurveysTest` |

**Phone, dark theme and English.** Every page above is captured in the eight configurations by `SurveyPagesVisualTest`, which also checks for overflow. P19w-12 covers the phone, P19w-13 the dark theme, and P19w-14 and P19w-16 the language.

## Mockups

Method: each `preview.html` is rendered at 1440 with `app.css` and `_preview-bundle.css` injected. None of these previews has a dark variant. Each one is compared with:

- `SurveyPagesVisualTest` (light-1440-fr), for the screens
- `/dev/design-system/{section}`, for the components

| Mockup | Status | Notes |
| --- | --- | --- |
| ScreenSurvey a (builder) | matches | Omitted pieces follow plan 19: P19-01 to P19-06. |
| ScreenSurvey b (participant) | matches | Only the omitted "~ 1 min left" (P19-07). |
| ScreenSurvey c (results) | fixed; open | **Fixed:** the NPS histogram now has the caption "Score distribution". **Open:** the card header ("Q1 · Scale 1 – 5" vs "1 / 5" with kind and Anonymous badges) was already reported. The NPS histogram is coloured red, yellow and green as `SurveyQuestion` draws it. Frame c draws grey passives: the two mockups disagree. |
| SurveyQuestion | fixed | Multiple-choice results now carry "% of the respondents who ticked the option". |
| HealthCheck | fixed; open | **Fixed:** the add form asks the short label before the statement. **Open:** the switch is "Archive" in the app. The wording is "Affirmations / Intégrée / Libellé de l'axe" vs "Énoncés / Intégré / Libellé court". The preview stacks the fields, while the README puts them on one row (the app follows the README). These items were already reported. |
| MoodTrendChart | matches; open | **Matches:** the ROTI variant has the band, the "3 · okay" threshold and the coloured levels. **Open:** the health variant (health-check page) has no band (no quartiles on the server) and no threshold (the component draws none off the ROTI scale). It also has a 0 to 5 axis (P19-21). Already reported. |
| Chart | matches | Bars, lines, legend and palette order are as drawn. The bench adds the "View the data" table and the empty and loading states. |
| Slider | fixed | The bench wrote "1 minutes"; it now writes "8 min", as drawn. The values are shown in the mono font (tabular), where the mockup uses bold; this was left as is. |

**Spec divergence (not a mockup), open.** Spec §9.4 gives a guest the session shell on the results page. The app gives the guest a bare `main`, with no header and no logo (CVS-05 proves what is built).

## Acceptance criteria (spec §15)

| # | Criterion (short) | Test |
| --- | --- | --- |
| 1 | Five types in order; Poll creates a draft and opens the builder; 403 without view | R22S-04 (five types), P19w-01; feature `CreateTeamSurveyTest` |
| 2 | Health-check and Team pulse templates; a duplicate copies questions, not answers | P19w-11, P19w-01, CVS-11 |
| 3 | Builder: five kinds, edit, reorder, duplicate, delete, required, autosave; non-editor 403 | CVS-12, P19w-02, P19w-17 (keyboard), CVS-01; limits: feature `TeamSurveyBuilderTest`, concurrency |
| 4 | Publish needs a question; locked once open; "Back to draft" until the first answer | P19w-02, P19w-03, CVS-13 |
| 5 | Member and guest answer; outsider, guests off, replaced link refused; attached survey refused | P19w-04, P19w-06, CVS-03, CVS-06, CVS-07, CVS-08 |
| 6 | Values per kind; Finish refused with a required question unanswered | P19w-04 (required); values: feature `TeamSurveyAnswersTest` |
| 7 | Redaction per viewer | P19w-07, P19w-09; feature `TeamSurveyResultsTest` |
| 8 | Threshold of 3 | P19w-07 |
| 9 | No link from an answer to a respondent | feature tests only (not visible) |
| 10 | Mean 3.8, mode 4, NPS 22 (2/3/4), "6 · 67%" | CVS-15 |
| 11 | Live counter, live cards, closing switches open pages | P19w-05 |
| 12 | Channel authorisation | feature tests only |
| 13 | Compare | P19w-08, CVS-14; feature `CompareSurveysTest` |
| 14 | CSV for an editor of a closed survey | P19w-09 |
| 15 | Delete tells the open pages | P19w-10 |
| 16–18 | Health import | feature and upgrade tests only |
| 19 | No health-check phase | P08a, P08b-02 |
| 20 | Health check attached to a retro | P08b-02 to P08b-07 |
| 21 | Statement change rebuilds open health checks | feature tests only |
| 22 | Mood trend point of a survey, linked to its results | P19-31-08, CVS-16 |
| 23 | `previousAverage`, session-end rows | P08d-04b |
| 24 | Retro surveys unchanged | P08c, P08d-04c |
| 25 | Team page lists surveys; draft for editors only; "Start a health check" | P19w-01, CVS-10, P19w-11, CVS-09 (no button for an observer) |
| 26 | Strings in four languages; captures without overflow | `InformalRegisterTest`, `TranslationKeysTest`, `SurveyPagesVisualTest` |
| 27 | Suites on four engines | PHP suites (not browser) |
