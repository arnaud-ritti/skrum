---
title: "Jira Cloud"
description: "Create the Atlassian OAuth app, enter its credentials, and connect a team to its Jira site for imports, estimates, exports and status sync."
order: 6
related:
  - integrations/overview
  - planning-poker/tasks-and-imports
  - action-items/export-and-sync
  - integrations/jira-data-center
---

After this page, a team can import Jira issues into planning poker, write estimates back, export action items as issues and keep their status in step. An instance admin creates one Atlassian app; each team then connects its Jira site. For a Jira server you host yourself, see [Jira Data Center](../jira-data-center/).

## What it does

| Access | What the team can do |
|---|---|
| **Read only** | Import issues into planning poker and receive status updates from Jira when sync is on |
| **Read and write** | Also write estimates to the story points field, export action items as issues with an assignee and a priority |

With read-and-write access, the team can turn on the two-way status sync: completing an action item moves its Jira issue to done, closing the issue completes the item, and imported poker tasks follow their issue.

With read-only access, imported tasks can still follow their Jira issue when status sync is on; Skrüm cannot write changes back to Jira.

Imports show all accessible issues when no filters are selected. **Project**, **Board** and **Sprint** are optional. A project limits issues to that project; a board applies its saved filter and can cover several projects. You can also use JQL, search and status filters, and load further pages as you scroll: see [Tasks and imports](../../planning-poker/tasks-and-imports/).

## Import filters: project, board and sprint

Open **Import** from the planning poker task sidebar. **Project** appears above **Board** and **Sprint**. These filters are optional: leave them empty to browse all issues accessible to the Jira account that connected the team.

A Jira project groups issues. Scrum and Kanban describe how a board organizes work; they are not a requirement for selecting a project in Skrüm. You can import by project without choosing a board or a sprint.

| Filter or board type | What it means | Import constraints |
|---|---|---|
| **Project** | The Jira project containing the issues | Limits the list to that project. Does not require a board or a sprint |
| **Scrum board** | A board used to organize work into timeboxed sprints | Applies the board's saved filter. You may then select an active or upcoming sprint, or leave Sprint empty to browse all issues matching the board filter |
| **Kanban board** | A board used for a continuous flow of work, without sprints | Applies the board's saved filter. Sprint stays disabled and Skrüm does not request sprints for this board |
| **Sprint** | A work period on a Scrum board | Requires a Scrum board. Skrüm lists active and upcoming sprints; completed sprints are not listed in this selector |

The board list includes both Scrum and Kanban boards. A board can cover several projects. Selecting both **Project** and **Board** keeps only issues that match both filters; a board does not automatically select its project. Search and status filters narrow the same list.

Only boards and issues visible to the connected Jira account are available. If the board list is empty, you can still import by project or leave all filters empty. For Jira Cloud, listing boards requires both `read:board-scope:jira-software` and `read:project:jira`; reconnect after granting missing scopes. See Atlassian's [Board API](https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/) for board access and types.

## Who can set it up

- The Atlassian app and its credentials: an instance admin, in **Administration**, then **Integrations**: see [Integration apps](../../administration/integration-apps/).
- A team's connection: a workspace owner or admin, or the team's owner, on the team's **Integrations** page. Skrüm acts in Jira as the Atlassian account of that person.

## Before you start

- The callback address is opened by the browser of the person who connects. The server running Skrüm must reach `auth.atlassian.com` and `api.atlassian.com`.
- Live status updates need Jira to call your instance, so `APP_URL` must be a public HTTPS address. On a private network the status sync still works: Skrüm asks Jira every `INTEGRATIONS_POLL_MINUTES` minutes, 5 by default. See [Integrations overview](../overview/).

## On the vendor's side

1. In the [Atlassian developer console](https://developer.atlassian.com/console/myapps/), create an OAuth 2.0 integration.
2. Under **Authorization**, select **Configure** next to OAuth 2.0 (3LO) and enter this callback URL, with your own address in place of `{APP_URL}`:

   ```text
   {APP_URL}/integrations/jira/callback
   ```

   Skrüm shows the exact value as **Callback URL** in the dialog of the next section.
3. Under **Permissions**, add the scopes Skrüm asks for. A read-only connection asks for these six:

   ```text
   offline_access
   read:jira-work
   read:board-scope:jira-software
   read:project:jira
   read:sprint:jira-software
   manage:jira-webhook
   ```

   Listing boards requires both `read:board-scope:jira-software` and `read:project:jira`. After adding a scope to an existing Atlassian app, select **Reconnect** in Skrüm and allow the updated permissions.

   A read-and-write connection asks for three more:

   ```text
   write:jira-work
   read:jira-user
   manage:jira-configuration
   ```

   `manage:jira-configuration` is required by Jira's [Search priorities](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-priorities/#api-rest-api-3-priority-search-get) endpoint, which Skrüm uses to populate priority mappings. Add it to the Atlassian app and reconnect existing read-and-write connections to grant it. Skrüm does not create or change Jira's priorities.

4. Under **Settings**, copy the **Client ID** and the **Secret**.
5. If people outside your own Atlassian account will connect, turn sharing on under **Distribution**.

Atlassian describes each step in [OAuth 2.0 (3LO) apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/).

You add no webhook by hand. When a team turns the status sync on, Skrüm registers its own webhooks through Jira's API, for the events `jira:issue_updated` and `jira:issue_deleted` on the projects of the linked issues, at this address:

```text
{APP_URL}/integrations/webhooks/jira/{integration}/{token}
```

Jira lets such webhooks live 30 days; Skrüm extends them before they expire. Atlassian describes them in [Webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/).

## In Skrüm, Administration

Open **Administration**, select **Integrations**, then **Configure** on the Jira row.

| Field | Environment variable |
|---|---|
| **Client ID** | `JIRA_CLIENT_ID` |
| **Client secret** | `JIRA_CLIENT_SECRET` |

Select **Save**. A value saved here wins over the environment variable.

![The Jira app dialog: the client ID and the client secret, both read from the environment, and the callback URL to copy](../../../assets/screenshots/integrations/jira-app.png)

## In the team's Integrations page

1. Open the team's settings and select **Integrations**.
2. Select **Connect** on the Jira row, then **Connect (read only)** or **Connect (read and write)**.
3. Allow the app on Atlassian's page.
4. If your Atlassian account reaches several Jira sites, the row reads **Setup required**: select **Finish setup** and choose the site under **Choose the Jira site this team uses:**.

The panel then offers these settings.

| Setting | What it does |
|---|---|
| **Story points field** | The Jira field estimates are read from and written to. Skrüm detects it; choose another number field if it picked the wrong one, or select **Detect again** after changing your Jira fields |
| **People** | Which Jira account each member is, for the assignee of exported issues. **Match by email** looks every member up on your Jira site. For one person, choose an account, **Never assign**, or **Reset** |
| **Priorities** | The Jira priority given to an exported issue for each of **High**, **Medium** and **Low**: the default, a priority of your site, or **Don't set** |
| **Sync status** | Turns the status sync on, after a confirmation: the first sync takes the state of every linked issue, then the most recent change wins |
| **Status mapping** | Per project, which statuses count as done and which status an issue moves to when its item is started, completed or reopened. **Automatic** uses the done statuses of each workflow. A project appears once an action item was exported to it or a task imported from it |

**People** and **Priorities** appear with read and write access only. **Upgrade to read and write** asks Atlassian for the three extra scopes.

![The Jira panel of a connected team: the site and its access, the story points field, the people and their Jira accounts, the priorities, and the status sync with live updates](../../../assets/screenshots/integrations/jira-card.png)

To write story points, the connection also needs `write:jira-work` and the connected account must be allowed to edit the issue. Skrüm checks the issue's edit metadata before writing: the selected numeric field must be editable for that project and issue type. See [Get edit issue metadata](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueIdOrKey-editmeta-get).

## Test it

Open the panel and select **Test the connection**. Skrüm checks that the site is still listed among the Jira sites accessible with the stored token and shows **The connection works.** This check does not test board, sprint or issue permissions; also try an import to verify those scopes.

## Troubleshooting

| What you see | What to do |
|---|---|
| **Could not connect Jira. Try again.** | The consent was cancelled, or the client ID, secret or callback URL do not match the Atlassian app |
| **This Atlassian account has no Jira site.** | Connect with an account that has access to the Jira site |
| **Reconnect required** | The access was revoked or expired, or the site is no longer accessible. Select **Reconnect** |
| **Unauthorized; scope does not match** | Check that the Atlassian app has all the scopes listed above, including `read:project:jira` for boards and `manage:jira-configuration` for priority mappings, then select **Reconnect** and allow the updated permissions |
| **Reconnect Jira to receive live updates.** | The connection was made without the `manage:jira-webhook` scope. Add it to the Atlassian app, then select **Reconnect** |
| **Checking every 5 minutes.** | The instance does not accept Jira's calls, so Skrüm polls. Nothing to do: the sync works, with that delay |
| **Webhooks aren't reaching skrum; checking every 5 minutes.** | Jira's calls do not arrive. Check that `APP_URL` is reachable from the internet |
| **No story points field found.** | Skrüm lists custom numeric fields using `read:jira-work`. If the connection needs reconnecting, reconnect first, then select **Detect again**. Otherwise check that a numeric story points field exists and is visible to the connected account |

## Disconnecting

Turn the row's switch off, or select **Disconnect** in the panel, and confirm. Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Skrüm asks Jira to remove the webhooks it registered.

Atlassian does not let Skrüm revoke its own access. The person who connected removes the app under **Connected apps** in their Atlassian account settings.

## Official documentation

- [OAuth 2.0 (3LO) apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/)
- [Developer console](https://developer.atlassian.com/console/myapps/)
- [Webhooks](https://developer.atlassian.com/cloud/jira/platform/webhooks/)
