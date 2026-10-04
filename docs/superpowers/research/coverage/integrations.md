# Coverage matrix: integrations

Coverage pass of 2026-10-04 on `tests/coverage-integrations`. "CVI" tests are in `tests/Browser/Walkthroughs/CoverageIntegrationsTest.php`.

The 404 the walkthrough sweep met on `GET /w/{workspace}/teams/{team}/integrations` is by design, not a bug. `EnsureIntegrationProviderEnabled` answers 404 while no provider is configured on the instance. In that state the team settings offer no Integrations entry. The dev database of the sweep had no provider configured. P12a-01c proves this, and the feature test `IntegrationsPageTest` ("does not exist while no provider is configured") covers it too.

## GET routes

| Route | Kind | Renders for the right person | Refused for the wrong person |
| --- | --- | --- | --- |
| `teams.integrations.index` `w/{workspace}/teams/{team}/integrations` | page | P12a-01a (workspace admin, from the team header gear), CVI-02 (team owner who is only a workspace member), P18e-10-10, P12a-02 to 07, P14a-*, P14b-*, P14c-*, P14d-*, P15-*; phone, dark and English: P12a-08a, P12a-08b, P12a-08c; captures `team-integrations-*` in SettingsPagesVisualTest | CVI-01a (visitor: login), CVI-01b (facilitator, observer, admin of another workspace: 403), P12a-01b and P14b-07 (member: 403, no link), P12a-01c (no provider configured: 404, no link); feature: TeamIntegrationRoutesAuthorizationTest, IntegrationsPageTest |
| `teams.integrations.connect` `…/integrations/{provider}/connect` | redirect to the provider | CVI-04 (Slack connect from the page, then its callback); links checked in P12a-01a, P12a-04a, P14c-01, P14c-07; feature: ConnectSlackTest, ConnectJiraTest, ConnectLinearTest, ConnectJiraDataCenterTest, ConnectGitHubTest | TeamIntegrationRoutesAuthorizationTest (team roles, other workspace, visitor), ConnectSlackTest (member, disabled provider) |
| `integrations.callback` `integrations/{provider}/callback` | redirect back to the page | CVI-04 (lands on the integrations page with "Slack connected." and the card Connected); feature: Connect*Test | CVI-04 (state that does not match: "Could not connect Slack. Try again.", nothing connected); feature: Connect*Test (expired state, other provider, denied consent), IntegrationSettingsTest (404 when turned off) |
| `integrations.jiraDataCenter.callback` | redirect | feature: ConnectJiraDataCenterTest | ConnectJiraDataCenterTest |
| `teams.integrations.userMappings.index` | JSON | browser P12d-01, P12d-02a (People panel); feature: UserMappingEndpointsTest | TeamIntegrationRoutesAuthorizationTest |
| `teams.integrations.accounts.index` | JSON | browser P12d-02a (account search); feature: UserMappingEndpointsTest, GitHubExportTest | TeamIntegrationRoutesAuthorizationTest |
| `teams.integrations.priorities.index` | JSON | browser P12d-02b, P14c-04; feature: PriorityMappingTest, JiraDataCenterExportTest | TeamIntegrationRoutesAuthorizationTest |
| `teams.integrations.statuses.index` | JSON | browser P14d-06, CVI-05; feature: StatusSyncSettingsTest | TeamIntegrationRoutesAuthorizationTest |
| `teams.integrations.targets.index` | JSON | browser P12d-03, P12d-04, RT21-13, R24-04; feature: ExportTargetsTest, JiraDataCenterExportTest, GitHubExportTest | ExportTargetsTest (other workspace, other team of the workspace, read-only connection, chat channel, 404 for another team's connection; visitor 401 added in this pass) |
| `teams.integrations.trackerWebhook.show` | JSON | browser P14d-09a, P14d-09b; feature: TrackerWebhooksTest | TeamIntegrationRoutesAuthorizationTest |
| `teams.integrations.deliveries.index` | JSON | browser P14b-03b, P15-01 to P15-05; feature: ConnectOutgoingWebhookTest, WebhookRedeliveryTest | TeamIntegrationRoutesAuthorizationTest (and 404 for another team's webhook) |
| `teams.integrations.deliveries.show` | JSON | browser P15-01, P15-02; feature: WebhookRedeliveryTest | TeamIntegrationRoutesAuthorizationTest |
| `admin.integrations.edit` `admin/integrations` | page | R29-05; captures `admin-integrations-page`, `admin-integrations-slack-dialog` (AdminAndErrorPagesVisualTest, eight configurations) | R29-01 (member: 403, admin asked for the password); feature: AdminAccessTest, IntegrationSettingsTest |
| `admin.integrationConfirmation.create` `admin/integrations/confirm` | page | feature: IntegrationSettingsTest | feature: AdminAccessTest |

The POST inbound webhook routes (`integrations.webhooks.*`) are not GET routes. P14d-11a, P14d-13a and InboundWebhooksTest cover them.

## Mockups

ScreenSettings has no dark variant. The preview was rendered at 1440 with `app.css` and `_preview-bundle.css`, light and with the `dark` class. The app captures came from the visual tests at light-1440-fr: `team-settings-members`, `team-integrations-page`, and `admin-*` for branding, SSO, SMTP, integrations, MCP keys and licence. The preview's icons (`data-lucide`) do not draw without their script, so icons were compared in the code.

| Mockup part | Status | What |
| --- | --- | --- |
| a) Members card | matches / open | Table, role selects, last activity, role definitions footer and Invitation link / Invite match. Open: the mockup's "Voir les 11" footer link (the app lists every member). |
| a) Default facilitators | open | The mockup reads "Rotation à chaque rétro" and "Prochaine : Inès · rétro du 2 oct.". The app reads "Faire tourner la suggestion à chaque rétro" and "Suggestion suivante : Théo Martin" (the plan 23 wording of a suggestion; owner ruling needed to change it). |
| a) Retro templates, default columns, 8 colours | matches | The app adds "Parcourir" and the Sprints card (plan 23). |
| a) Segmented tabs | open (known) | The app uses the side sub-navigation of the settings shell. The front-rewrite spec rules this, and the walkthrough report already lists it. |
| b) Integrations rows (team page and admin page) | matches / open | Logo box, name, status line in success text, "Configurer" plus switch, and "Connecter" when not connected all match. Open (known): brand logos (the app draws a generic icon) and the "Non connecté · purpose" line. The admin page reads "Disponible · n équipes connectées", as ruled in P29-03. |
| b) SMTP | fixed | The "Opérationnel" badge now carries its status dot. |
| b) Admin sub-navigation footer | fixed | The instance box now shows the green dot beside "v… · à jour", as the mockup's `sk-dot`. |
| b) Admin sub-navigation | matches | Sections and order, the SSO "actif" badge while SSO is in force, and the integrations "n/m" count. |
| b) Branding | matches / open | Logo, live preview with Light/Dark, contrast badge and guard, radius, avatar styles and "Revenir à Skrüm" all match. Open: the labels "Nom d'affichage" (mockup "Nom affiché") and "Arrondi des angles" (mockup "Arrondis"). These are global translation keys used elsewhere. The image tabs and the photos switch are the plan 18d additions. |
| b) SSO / OIDC | open (ruled) | The app has one card per provider (Google, GitHub, Entra, OIDC) and a separate single sign-on card. The mockup has one OIDC card with an "Activée" switch. Plan 29 ruled this. |
| b) MCP keys | open | The app does not list revoked keys (the mockup has a struck-out row with "Révoquée"). The column reads "Créé", the mockup "Créée" (the key `Created` is shared with other tables). The app adds the Team and Expires columns. |
| b) Licence | open (known) | Mockup: Enterprise edition, seats progress, expiry and "Mettre à jour la clé". App: AGPL card. The walkthrough report lists this as an owner decision. |
| b) Admin topbar | matches | Self-host badge, Annuler and Enregistrer. The app shows the breadcrumb instead of the domain. |

## Roadmap acceptance criteria (integrations)

| Criterion | Test |
| --- | --- |
| P23-3: a team owner who is not a manager manages integrations | CVI-02; feature: TeamIntegrationRoutesAuthorizationTest (owner allowed, other roles refused) |
| P23-21: the Integrations tab only when enabled, refused (403) to others | P12a-01a, P12a-01b, P12a-01c, P18e-10-10, CVI-01b |
| P24-7: start status for a Jira project, saved and reset, "Start to" first | CVI-05; feature: StatusSyncSettingsTest (422, member refused); Vitest trackers.test.tsx |
| P29-9: a provider turned off disappears from the team settings, its connections are kept, and it comes back on when turned on again | R29-05 (admin switch, row kept), CVI-03 (team page hides and restores Slack with its connection); feature: IntegrationSettingsTest (callbacks 404) |
| P29-31: masked secret fields of the integration apps | `admin-integrations-slack-dialog` capture; Vitest integration-app-dialog.test.tsx |
| P21-20: bulk export of a retro's action items | RT21-13, CVR-03 (retro lane) |
| P24-22: "Sync to :tracker" from the bulk bar | R24-04 (actions lane); Vitest |
| P22-11: poker import at creation | see the poker matrix (R22-08, CVP-08, CVP-09) |

Phone, dark theme and English: the team integrations page is checked by P12a-08a (390), P12a-08b (dark) and P12a-08c (English and French), and captured in the eight configurations of SettingsPagesVisualTest. The admin integrations page is captured the same way in AdminAndErrorPagesVisualTest. This pass adds no new screen.

## App bugs found

None. The suspected 404 on the team integrations page is the intended behaviour (see the top of this file).
