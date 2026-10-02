
## Integration of wave 3 (2026-10-02)

No test and no capture was run at this integration (owner decision); what follows comes from reading the code and the lane's reports.

- The lane's deviation rows are numbered **D-78 to D-89** in the plan (they were D-47 to D-58 on the lane, which clashed with the whiteboard, access and games rows). Every reference in this file follows the new numbers.
- The sidebar entry "Team settings" leads to the integrations page when the instance has a provider configured (`features.integrations`, a new shared prop), and to the settings card of the team page (`#settings`) when it has none: the integrations page answers 404 in that case. The "Team" entry of the team settings shell lands on the same card, which now carries `id="settings"`.
- The sub-navigation brings its current entry into view below `lg` (the "Notifications" entry was cut at the edge at 390).
- The team switcher of the sidebar reads "1 member" for a team of one.

Differences with the mockup that remain, by screen (rows of the plan):

| Screen | Remaining | Row |
|---|---|---|
| Profile | no presence colours, photo upload or "Use initials"; footer sentence rewritten | D-25, D-78 |
| Security | breach line without a mark; "Turn off 2FA" asks for no code; French badge in the masculine; no sessions, linked accounts, "last changed" | D-79, D-80, D-81, D-25, D-26 |
| Appearance, notifications | sentence rewritten; one event; the table keeps its head at 390 | D-78, D-25, D-84 |
| API tokens | eight columns, absolute dates, scope badges; the copy-once panel in place of the footer | D-82, D-83 |
| Team settings, integrations | cards per provider, lucide icons, three crumbs, no creation date, plain dialogs for three confirmations | D-85 to D-89 |
| Team settings, sidebar entry | without a provider the entry opens the team page, not a settings screen | none: the mockup has no state without integrations |

Stale captures (to regenerate at the end-of-phase run): the French bench captures that show "Off" (toggle group, checkbox, session settings summary: "Repos" became "Désactivé"), `settings-notifications-*-390-*` (the sub-navigation now scrolls to its current entry), and every capture that shows the sidebar of a team of one.
