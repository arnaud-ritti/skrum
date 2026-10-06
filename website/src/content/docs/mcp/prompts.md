---
title: "Prompts"
description: "The two ready-made prompts of the Skrüm MCP server: what each one takes, what it hands to the assistant and what it asks for."
order: 3
related:
  - mcp/connect
  - mcp/tools
  - retrospectives/summary-and-sharing
  - insights/health-and-enps-trends
---

Use a prompt to get an analysis of a retrospective or of a team's health without telling the assistant which tools to call. The server offers two prompts, to every token: they only read.

## How a prompt works

A prompt takes one id. Skrüm gathers the data, adds instructions and hands both to your assistant as one message; the assistant writes the answer. Skrüm calls no language model for a prompt.

- The data is what the read tools return, with the same things hidden: see [Connect an AI assistant](../connect/).
- The instructions ask the assistant to answer in the language of your Skrüm account.
- The data is capped at 60,000 characters. What is left out to fit is said to the assistant.
- How you run a prompt depends on your client: see its documentation.

## analyze-retro

Analyses one retrospective.

| Argument | Required | Value |
|---|---|---|
| `board_id` | yes | The id of the retrospective. `retro.boards.list` returns it. |

What the assistant receives about the board:

- its summary;
- its themes and suggested actions, when the instance has an AI provider configured;
- its action items;
- its health check and its ROTI;
- its cards, most voted first when vote totals are visible, otherwise in the order of the board.

What it is asked to do: identify the key themes, the risks and what the team should change next time; check that the action items cover the top themes; point to the pending suggested actions you may promote; never guess who wrote an anonymous card.

When the board is too large, the least voted cards are left out first, or the last cards of the board when vote totals are hidden.

## team-health

Describes how a team is doing over its recent retrospectives.

| Argument | Required | Value |
|---|---|---|
| `team_id` | yes | The id of the team. `retro.teams.list` returns it. |

What the assistant receives about the team:

- its last six completed retrospectives, oldest first, each with its health check when one was run in it, its ROTI, how many action items it created and how many of them are completed, and its themes;
- the health trend over the team's last six closed health checks, run in a retrospective or on their own;
- the ROTI trend;
- how many of the team's action items are open, and how many are overdue.

Without an AI provider on the instance, the themes of a retrospective are replaced by its five most voted cards.

What it is asked to do: describe the trends, the strongest and the weakest health categories, how many action items get closed and what keeps repeating; compare a category only across the retrospectives that asked it, and say when the set of statements changed; say "health check not run yet" when there is no data.

When the data is too large, the themes of the oldest retrospectives are left out first, then the oldest retrospectives.
