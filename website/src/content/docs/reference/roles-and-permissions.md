---
title: "Roles and permissions"
description: "What each workspace role, team role and the instance admin may do, and what a guest may do in a session."
order: 1
related:
  - teams/members-and-roles
  - teams/workspaces
  - teams/invitations
  - administration/users-and-admins
  - getting-started/join-as-guest
---

Use this page to find out why a button is missing, or which role to give someone. Each table lists actions in rows and roles in columns.

## How the levels fit together

A person has one role in each workspace they belong to, and one role in each team they belong to. Being an instance admin is separate from both.

- A workspace **Owner** or **Admin** acts as the owner of every team of the workspace, whether or not they are a member of the team. They are never treated as an observer, whatever their role in the team says. One thing still needs membership of the team: adding an action item outside a retrospective.
- An instance admin gets no role in any workspace or team from being an instance admin. They see a workspace only when they are a member of it.
- Each session also has its own facilitator, who is not a team role. See [Inside a session](#inside-a-session).
- A guest has no account and no role. See [Guests](#guests).

## Workspace roles

The workspace roles are **Owner**, **Admin** and **Member**. Anyone with an account can create a workspace, and becomes its owner.

| Action | Owner | Admin | Member |
|---|---|---|---|
| Open the workspace | Yes | Yes | Yes |
| See the teams of the workspace | All | All | The teams they belong to |
| Ask to join a team they are not in | Yes | Yes | Yes |
| See the action items of the workspace | All teams | All teams | The teams they belong to |
| Change the name and the description of the workspace | Yes | Yes | No |
| Open the workspace's **Members** page | Yes | Yes | No |
| Invite someone to the workspace, as admin or member | Yes | Yes | No |
| Resend or revoke an invitation | Yes | Yes | Only an invitation to a team they may invite to |
| Change a member's role | Yes | Yes, except to or from owner | No |
| Remove a member | Yes | Yes, except an owner | No |
| Leave the workspace | Yes | Yes | Yes |
| Delete the workspace | Yes | No | No |
| Create a team | Yes | Yes | No |
| Delete a team | Yes | Yes | No |
| Save a retro template for themselves | Yes | Yes | Yes |
| Share a retro template with the whole workspace, change or delete such a template | Yes | Yes | No |
| Create, change or delete a poker deck of the workspace | Yes | Yes | No |
| Change or delete a whiteboard template | Any | Any | The ones they created |
| Delete a planning poker game, a whiteboard or a game room they do not run | Yes | Yes | No |
| Change, open, close or delete a survey they did not create | Yes | Yes | No |

A workspace always keeps one owner. The last owner cannot be given another role, be removed, or leave: the interface answers "A workspace needs at least one owner."

An invitation to a workspace gives the role admin or member. Only an owner can make someone an owner, from the **Members** page.

## Team roles

The team roles are **Owner**, **Facilitator**, **Member** and **Observer**. An invitation gives the role facilitator, member or observer; the owner role is given from the team's members page.

| Action | Owner | Facilitator | Member | Observer |
|---|---|---|---|---|
| Open the team, its sessions, its members, its insights, its health check, its eNPS, its activity and its estimates | Yes | Yes | Yes | Yes |
| Start a retrospective, a planning poker game, a whiteboard, a game room or a survey | Yes | Yes | Yes | No |
| Take part in a session | Yes | Yes | Yes | No, follows without taking part |
| Add an action item, comment on an action item | Yes | Yes | Yes | No |
| Save a poker deck for the team | Yes | Yes | Yes | No |
| Duplicate a whiteboard, save a whiteboard as a template | Yes | Yes | Yes | No |
| Take over a retrospective that is not completed, or the hosting of a game room | Yes | Yes | No | No |
| Create, change, delete and start sprints (team settings, **Sprints**) | Yes | Yes | No | No |
| Change the team's retro settings, its list of facilitators and its default template (team settings, **Retrospectives**) | Yes | Yes | No | No |
| Share a retro template with the team, change or delete such a template | Yes | Yes | No | No |
| See the health check statements (team settings, **Health check**) | Yes | Yes | No | No |
| Add, change, reorder or archive health check statements | Yes | No | No | No |
| Invite people by email, resend or revoke those invitations | Yes | Yes | No | No |
| Create or revoke the team's invite link | Yes | Yes | No | No |
| Add a member of the workspace to the team | Yes | No | No | No |
| Change a member's role, remove a member | Yes | No | No | No |
| Approve or decline a request to join the team | Yes | No | No | No |
| Change the team's name, description and link (team settings, **General**) | Yes | No | No | No |
| Choose the team's default poker deck | Yes | No | No | No |
| Connect, set up, test and disconnect integrations (team settings, **Integrations**) | Yes | No | No | No |
| Open **Data & export** in the team settings | Yes | No | No | No |
| Delete the team | No | No | No | No |

Only a workspace owner or admin can delete a team.

### Observers

An observer sees everything the team sees and changes nothing. On the team page they read "Observers cannot start sessions." Inside a session, an attempt to write is refused with "Observers can follow this session but not take part." In a planning poker game an observer joins as a spectator and does not vote.

A person who is made an observer while they facilitate a session keeps facilitating that session.

### Action items

Who may act on an action item depends on the item, not on the team role:

| Action | Who |
|---|---|
| Change or delete an item | The person who created it, the facilitator of the retrospective it comes from, a workspace owner or admin |
| Complete or reopen an item | The same people, the person the item is assigned to, and the facilitator of any retrospective of the team that is not completed |
| Comment on an item | Any member of the team except observers |
| Change a comment | Its author |
| Delete a comment | Its author, and whoever may delete the item |
| Export an item to a tracker | Whoever may change the item, with an account |

An observer of the team reads its action items and changes none of them, including one they created before becoming an observer.

### Poker decks and templates

A deck saved for a team can be changed or deleted by the person who saved it, as long as they may still start planning poker games in the team, and by a workspace owner or admin. A template someone saved for themselves can be changed or deleted by that person only.

## Inside a session

A retrospective, a planning poker game and a whiteboard each have one facilitator. A game room has a host. A survey is run by the person who created it. These are roles of the session, kept by one person at a time.

In a retrospective, the facilitator moves the phases, runs the timer, changes the board's settings and columns, turns guest access on or off, and deletes the retrospective. The facilitator can hand the role to anyone who may start that kind of session in the team.

| Session | Who can take it over | Who can delete it | Who can share it to a channel |
|---|---|---|---|
| Retrospective | While it is not completed: a team owner, a team facilitator, a workspace owner or admin | Its facilitator | Its facilitator while a member of the team, a workspace owner or admin |
| Planning poker game | Any member of the team except observers | Its facilitator, a workspace owner or admin | Its facilitator, a workspace owner or admin |
| Whiteboard | Any member of the team except observers | Its facilitator, a workspace owner or admin | Not shared to a channel |
| Game room | The person who created it, a team owner, a team facilitator, a workspace owner or admin | The person who created it, a workspace owner or admin | Its host or the person who created it while a member of the team, a workspace owner or admin |
| Survey | Nobody: the person who created it and the workspace's owners and admins change, open and close it | The person who created it, a workspace owner or admin | Not shared to a channel |

## Instance admin

The first account created on an instance is its instance admin. An instance admin opens **Administration**, whose pages ask them to confirm their password before they open.

| Action | Instance admin | Everyone else |
|---|---|---|
| Open **Administration** | Yes | No |
| Change the instance's settings in **General** and check for an update | Yes | No |
| Change the **Branding** | Yes | No |
| Set up sign-in and single sign-on in **SSO authentication** | Yes | No |
| Set up mail in **SMTP** and send a test email | Yes | No |
| Turn on and set up the providers in **Integrations** | Yes | No |
| List and revoke **MCP keys** | Yes | No |
| Read the **Licence** page | Yes | No |
| Find an account, deactivate it or reactivate it in **Users** | Yes | No |
| Add or remove an instance admin in **Admins** | Yes | No |
| Read the **Audit log** | Yes | No |

Two limits protect the instance:

- An instance keeps at least one admin: removing the last one is refused with "An instance needs at least one admin."
- An admin cannot deactivate their own account, or the last active admin.

When single sign-on is required for everyone, an instance admin who has a second factor can still sign in with their password, followed by that second factor.

## Guests

A guest is someone who joins one session through its guest link, with a name and no account. A person who has an account but is not a member of the session's team joins the same way. Guest access is turned on or off for each session; when it is turned off, the guests of that session lose access.

| Session | A guest can | A guest cannot |
|---|---|---|
| Retrospective | Take part as the members do: write cards, vote, comment, react, rate the session, add action items | Become the facilitator, share the retrospective to a channel, export an action item to a tracker, see the team's name or the links to the team's pages |
| Planning poker game | Vote | Add, change or import tasks, become the facilitator, share the game to a channel |
| Whiteboard | Draw on the board | Become the facilitator, duplicate the board, save it as a template |
| Game room | Play | Host the room, share the room to a channel |
| Survey | Answer | Change, duplicate or export the survey, compare it with another one |

A guest is never emailed. An action item can be assigned to a guest only from the retrospective the guest joined.
