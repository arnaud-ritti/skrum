---
title: "Webhook events"
description: "Every event Skrüm sends to a team's webhook, when it is sent, and an example of its body."
order: 2
related:
  - integrations/webhooks
  - integrations/overview
  - action-items/export-and-sync
---

Use this page to write the code that receives Skrüm's webhook. It lists the 10 events a team's webhook can receive: 5 that the team turns on, 4 that are sent when someone shares a session, and 1 test event.

Connecting the webhook, checking the signature, retries and the delivery log are on the [Webhooks](../../integrations/webhooks/) page.

## The body of every event

Every event is a `POST` request with a JSON body of the same shape:

| Field | Value |
|---|---|
| `version` | `1` |
| `id` | The identifier of the delivery. It is the same on every retry and on a redelivery, so you can use it to ignore a body you already handled. The header `X-Skrum-Delivery` carries the same value |
| `event` | The name of the event. The header `X-Skrum-Event` carries the same value |
| `occurredAt` | When the event happened, in UTC |
| `sentAt` | When this attempt was sent, in UTC. It changes on every attempt |
| `team` | The `id` and the `name` of the team the webhook belongs to |
| `data` | What the event is about. Its content depends on the event |

Dates and times are written as `2026-10-06T10:05:00Z`. A day alone is written as `2026-10-15`.

The body is sent on one line. The examples on this page are the bodies of real requests, indented here for reading: check the signature against the bytes you receive, not against a body you formatted again.

A field that has no value is sent as `null`, not left out.

## The events at a glance

| Event | Sent when | Sent because |
|---|---|---|
| [`retro.completed`](#retrocompleted) | A retrospective is completed | The event is ticked |
| [`action_item.created`](#action_itemcreated) | An action item is created | The event is ticked |
| [`action_item.completed`](#action_itemcompleted) | An action item is completed | The event is ticked |
| [`action_item.reopened`](#action_itemreopened) | A completed action item is reopened | The event is ticked |
| [`poker.task.estimated`](#pokertaskestimated) | A planning poker task gets its final estimate | The event is ticked |
| [`retro.link`](#retrolink) | Someone shares the link of a retrospective to the webhook | Someone asked for it |
| [`retro.results`](#retroresults) | Someone shares the results of a completed retrospective to the webhook | Someone asked for it |
| [`poker.link`](#pokerlink) | Someone shares the link of a planning poker game to the webhook | Someone asked for it |
| [`game_room.link`](#game_roomlink) | Someone shares the link of a game room to the webhook | Someone asked for it |
| [`webhook.test`](#webhooktest) | Someone selects **Send a test message** | Someone asked for it |

The first five are the events listed under **Send automatically** on the webhook's card, in the team's **Integrations** settings. Only the ones that are ticked are sent. The share events and the test event do not depend on those ticks.

No event carries an email address, the author of a card, who voted for what, a comment or a sub-task. A guest is never named as the person who created or completed an action item. Where a guest is named, among the participants or as the person an item is assigned to, ` (guest)` follows their name.

## Events the team turns on

### retro.completed

Sent when a retrospective reaches its last phase. If the retrospective is moved back to an earlier phase and completed again, the event is sent again.

| Field of `data` | Value |
|---|---|
| `title`, `url` | The title of the retrospective and its address |
| `completedAt` | When it was completed |
| `participants.count` | How many people took part |
| `participants.names` | Their names, in alphabetical order. `null` when the retrospective is anonymous |
| `cardCount` | How many cards were written |
| `roti` | The `average` of the ratings, rounded to one decimal, and how many `respondents` gave one. `null` when nobody rated the session |
| `summary` | The text of the summary when one is ready, otherwise `null` |
| `actionItems` | Up to 10 action items of the retrospective, the open ones first, then by priority. Each has its `content`, the name of its `assignee` or `null`, `dueOn`, `priority` (`high`, `medium` or `low`) and `isCompleted` |
| `moreActionItems` | How many action items were left out of the list |
| `suggestedActions` | The text of up to 5 suggested actions nobody has accepted or dismissed yet |
| `topCards` | For each column that has a card with at least one vote, the most voted card: the title of its `column`, its `content` (cut after 300 characters), its `votes`, and `groupedCount`, the number of cards grouped under it |
| `retro.id` | The identifier of the retrospective |

```json
{
    "version": 1,
    "id": "01a11333-3648-7365-96c7-f6f2f4f54b11",
    "event": "retro.completed",
    "occurredAt": "2026-10-06T10:05:00Z",
    "sentAt": "2026-10-06T10:05:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "title": "Sprint 42 retrospective",
        "url": "https://skrum.example.com/retros/01a11333-3615-736c-93d9-a90d2520fa3e",
        "completedAt": "2026-10-06T10:05:00Z",
        "participants": {
            "count": 4,
            "names": [
                "Camille Roux",
                "Inès Benali",
                "Malik Kone",
                "Théo Martin"
            ]
        },
        "cardCount": 3,
        "roti": {
            "average": 4.5,
            "respondents": 4
        },
        "summary": "The team is happy with how fast reviews are answered. The end-to-end tests fail at random and hide real failures.",
        "actionItems": [
            {
                "content": "Quarantine the end-to-end tests that fail at random",
                "assignee": "Inès Benali",
                "dueOn": "2026-10-15",
                "priority": "high",
                "isCompleted": false
            }
        ],
        "moreActionItems": 0,
        "suggestedActions": [
            "Agree on who answers a review request first"
        ],
        "topCards": [
            {
                "column": "Went well",
                "content": "Code reviews are answered within a day",
                "votes": 2,
                "groupedCount": 0
            },
            {
                "column": "To improve",
                "content": "The end-to-end tests fail at random",
                "votes": 3,
                "groupedCount": 1
            }
        ],
        "retro": {
            "id": "01a11333-3615-736c-93d9-a90d2520fa3e"
        }
    }
}
```

### action_item.created

Sent when an action item is created in the team: during a retrospective, from the action items page, from a suggested action, by an AI assistant, or as the next occurrence of a recurring item.

| Field of `data.actionItem` | Value |
|---|---|
| `id`, `content` | The identifier of the item and its text |
| `status` | `completed` or `open`. An item that is in progress is `open` |
| `assignee` | The `name` of the person the item is assigned to, or `null` |
| `createdBy` | The `name` of the person who created the item. `null` when a guest created it |
| `completedBy` | The `name` of the person who completed the item in Skrüm. `null` on this event |
| `dueOn` | The day the item is due, or `null` |
| `priority` | `high`, `medium` or `low` |
| `completedAt` | When the item was completed, or `null` |
| `url` | The address of the item on the action items page |
| `retro` | The `id`, the `title` and the `url` of the retrospective the item comes from. `null` for an item created outside a retrospective |
| `themeName` | The name of the theme of the retrospective the item is filed under, or `null` |
| `createdAt` | When the item was created |

```json
{
    "version": 1,
    "id": "01a11333-3633-7053-8b39-46c0814c75bb",
    "event": "action_item.created",
    "occurredAt": "2026-10-06T09:50:00Z",
    "sentAt": "2026-10-06T09:50:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "actionItem": {
            "id": "01a11333-3631-7293-96b5-2d4deff4ce61",
            "content": "Quarantine the end-to-end tests that fail at random",
            "status": "open",
            "assignee": {
                "name": "Inès Benali"
            },
            "createdBy": {
                "name": "Théo Martin"
            },
            "completedBy": null,
            "dueOn": "2026-10-15",
            "priority": "high",
            "completedAt": null,
            "url": "https://skrum.example.com/w/nordlys/action-items?team=01a11333-35cf-7394-bbe8-1834268e17c3&item=01a11333-3631-7293-96b5-2d4deff4ce61",
            "retro": {
                "id": "01a11333-3615-736c-93d9-a90d2520fa3e",
                "title": "Sprint 42 retrospective",
                "url": "https://skrum.example.com/retros/01a11333-3615-736c-93d9-a90d2520fa3e"
            },
            "themeName": null,
            "createdAt": "2026-10-06T09:50:00Z"
        }
    }
}
```

### action_item.completed

Sent when an action item is completed, in Skrüm or through the issue it is linked to in a tracker.

`data.actionItem` has the fields of [`action_item.created`](#action_itemcreated). `completedBy` holds the name of the person who completed the item in Skrüm; it is `null` when a guest completed it or when the change came from a tracker. Two more fields sit beside `actionItem`:

| Field of `data` | Value |
|---|---|
| `origin` | `skrum` when the item was completed in Skrüm, `external` when the change came from a tracker |
| `completedVia` | `null` when `origin` is `skrum`. Otherwise the `source` (`jira`, `jira_dc`, `linear` or `github`) and the `key` of the linked issue |

```json
{
    "version": 1,
    "id": "01a11333-3669-7239-8906-4303e34b3ba6",
    "event": "action_item.completed",
    "occurredAt": "2026-10-08T11:20:00Z",
    "sentAt": "2026-10-08T11:20:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "actionItem": {
            "id": "01a11333-3631-7293-96b5-2d4deff4ce61",
            "content": "Quarantine the end-to-end tests that fail at random",
            "status": "completed",
            "assignee": {
                "name": "Inès Benali"
            },
            "createdBy": {
                "name": "Théo Martin"
            },
            "completedBy": {
                "name": "Inès Benali"
            },
            "dueOn": "2026-10-15",
            "priority": "high",
            "completedAt": "2026-10-08T11:20:00Z",
            "url": "https://skrum.example.com/w/nordlys/action-items?team=01a11333-35cf-7394-bbe8-1834268e17c3&item=01a11333-3631-7293-96b5-2d4deff4ce61",
            "retro": {
                "id": "01a11333-3615-736c-93d9-a90d2520fa3e",
                "title": "Sprint 42 retrospective",
                "url": "https://skrum.example.com/retros/01a11333-3615-736c-93d9-a90d2520fa3e"
            },
            "themeName": null,
            "createdAt": "2026-10-06T09:50:00Z"
        },
        "origin": "skrum",
        "completedVia": null
    }
}
```

### action_item.reopened

Sent when a completed action item is opened again, in Skrüm or through the issue it is linked to in a tracker.

The fields are those of [`action_item.completed`](#action_itemcompleted). `status` is `open`, and `completedBy` and `completedAt` are `null`. When the change came from a tracker, `origin` is `external` and `completedVia` names the linked issue.

```json
{
    "version": 1,
    "id": "01a11333-366f-71c8-9916-108b9373d1ca",
    "event": "action_item.reopened",
    "occurredAt": "2026-10-08T15:45:00Z",
    "sentAt": "2026-10-08T15:45:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "actionItem": {
            "id": "01a11333-3631-7293-96b5-2d4deff4ce61",
            "content": "Quarantine the end-to-end tests that fail at random",
            "status": "open",
            "assignee": {
                "name": "Inès Benali"
            },
            "createdBy": {
                "name": "Théo Martin"
            },
            "completedBy": null,
            "dueOn": "2026-10-15",
            "priority": "high",
            "completedAt": null,
            "url": "https://skrum.example.com/w/nordlys/action-items?team=01a11333-35cf-7394-bbe8-1834268e17c3&item=01a11333-3631-7293-96b5-2d4deff4ce61",
            "retro": {
                "id": "01a11333-3615-736c-93d9-a90d2520fa3e",
                "title": "Sprint 42 retrospective",
                "url": "https://skrum.example.com/retros/01a11333-3615-736c-93d9-a90d2520fa3e"
            },
            "themeName": null,
            "createdAt": "2026-10-06T09:50:00Z"
        },
        "origin": "skrum",
        "completedVia": null
    }
}
```

### poker.task.estimated

Sent when the estimate of a planning poker task is saved, or changed to another value. Nothing is sent when the estimate is cleared, or saved again with the same value.

| Field of `data` | Value |
|---|---|
| `game` | The `id`, the `title` and the `url` of the game |
| `task.id`, `task.title` | The identifier of the task and its title |
| `task.url` | The address of the game |
| `task.estimate` | The card that was kept, as text |
| `task.deckName` | The name of the deck the game is played with |
| `task.external` | For a task imported from a tracker, its `source` (`jira`, `jira_dc`, `linear` or `github`), its `key` and its `url` there. Otherwise `null` |
| `estimatedAt` | When the estimate was saved |

No vote and no player is sent.

```json
{
    "version": 1,
    "id": "01a11333-3664-73c3-804f-819608e54405",
    "event": "poker.task.estimated",
    "occurredAt": "2026-10-07T14:12:00Z",
    "sentAt": "2026-10-07T14:12:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "game": {
            "id": "01a11333-3652-70b7-a15b-0185cc220e46",
            "title": "Sprint 43 sizing",
            "url": "https://skrum.example.com/poker/01a11333-3652-70b7-a15b-0185cc220e46"
        },
        "task": {
            "id": "01a11333-3654-71eb-8784-df3bd4810397",
            "title": "Sign in with a passkey",
            "url": "https://skrum.example.com/poker/01a11333-3652-70b7-a15b-0185cc220e46",
            "estimate": "8",
            "deckName": "Fibonacci",
            "external": {
                "source": "jira",
                "key": "ATL-128",
                "url": "https://nordlys.atlassian.net/browse/ATL-128"
            }
        },
        "estimatedAt": "2026-10-07T14:12:00Z"
    }
}
```

## Events sent when someone shares

These events are sent when a person picks the webhook as the channel in the share dialog of a session. Who may share is on the [Roles and permissions](../roles-and-permissions/) page.

### retro.link

Sent when someone shares the link of a retrospective that is not completed.

| Field of `data` | Value |
|---|---|
| `title` | The title of the retrospective |
| `url` | The address of the retrospective. When the person ticked **Include the guest link**, the guest link instead |
| `sharedBy` | The name of the person who shared it |

```json
{
    "version": 1,
    "id": "01a11333-3624-7223-a6dc-18b18818b831",
    "event": "retro.link",
    "occurredAt": "2026-10-06T09:30:00Z",
    "sentAt": "2026-10-06T09:30:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "title": "Sprint 42 retrospective",
        "url": "https://skrum.example.com/retros/01a11333-3615-736c-93d9-a90d2520fa3e",
        "sharedBy": "Théo Martin"
    }
}
```

### retro.results

Sent when someone shares the results of a completed retrospective. `data` has the fields of [`retro.completed`](#retrocompleted), without `retro`.

```json
{
    "version": 1,
    "id": "01a11333-364f-71d4-9008-1bacc9f00591",
    "event": "retro.results",
    "occurredAt": "2026-10-06T10:07:00Z",
    "sentAt": "2026-10-06T10:07:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "title": "Sprint 42 retrospective",
        "url": "https://skrum.example.com/retros/01a11333-3615-736c-93d9-a90d2520fa3e",
        "completedAt": "2026-10-06T10:05:00Z",
        "participants": {
            "count": 4,
            "names": [
                "Camille Roux",
                "Inès Benali",
                "Malik Kone",
                "Théo Martin"
            ]
        },
        "cardCount": 3,
        "roti": {
            "average": 4.5,
            "respondents": 4
        },
        "summary": "The team is happy with how fast reviews are answered. The end-to-end tests fail at random and hide real failures.",
        "actionItems": [
            {
                "content": "Quarantine the end-to-end tests that fail at random",
                "assignee": "Inès Benali",
                "dueOn": "2026-10-15",
                "priority": "high",
                "isCompleted": false
            }
        ],
        "moreActionItems": 0,
        "suggestedActions": [
            "Agree on who answers a review request first"
        ],
        "topCards": [
            {
                "column": "Went well",
                "content": "Code reviews are answered within a day",
                "votes": 2,
                "groupedCount": 0
            },
            {
                "column": "To improve",
                "content": "The end-to-end tests fail at random",
                "votes": 3,
                "groupedCount": 1
            }
        ]
    }
}
```

### poker.link

Sent when someone shares the link of a planning poker game. The fields are those of [`retro.link`](#retrolink), for the game.

```json
{
    "version": 1,
    "id": "01a11333-365a-7296-ba23-7d031c5113b8",
    "event": "poker.link",
    "occurredAt": "2026-10-07T14:00:00Z",
    "sentAt": "2026-10-07T14:00:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "title": "Sprint 43 sizing",
        "url": "https://skrum.example.com/poker/01a11333-3652-70b7-a15b-0185cc220e46",
        "sharedBy": "Théo Martin"
    }
}
```

### game_room.link

Sent when someone shares the link of a game room.

| Field of `data` | Value |
|---|---|
| `title` | The name of the room |
| `game` | The name of the game played in the room, in the language of the person who shared it |
| `team` | The name of the team |
| `url` | The address of the room. When the person ticked **Include the guest link**, the guest link instead |
| `sharedBy` | The name of the person who shared it |

No player and nothing of the game in progress is sent.

```json
{
    "version": 1,
    "id": "01a11333-3679-7370-a1be-35740cbefa91",
    "event": "game_room.link",
    "occurredAt": "2026-10-09T16:30:00Z",
    "sentAt": "2026-10-09T16:30:01Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "title": "Friday break",
        "game": "Hangman",
        "team": "Atlas",
        "url": "https://skrum.example.com/games/01a11333-3673-72eb-862f-3980d3c9dd27",
        "sharedBy": "Camille Roux"
    }
}
```

## The test event

### webhook.test

Sent when someone selects **Send a test message** on the webhook's card. `data.message` is a short sentence in that person's language. The `id` is made for this request alone, and the request does not appear in the delivery log.

```json
{
    "version": 1,
    "id": "5869aee0-2a52-4656-8c08-9a44273c9ea9",
    "event": "webhook.test",
    "occurredAt": "2026-10-05T16:00:00Z",
    "sentAt": "2026-10-05T16:00:00Z",
    "team": {
        "id": "01a11333-35cf-7394-bbe8-1834268e17c3",
        "name": "Atlas"
    },
    "data": {
        "message": "skrum is connected."
    }
}
```
