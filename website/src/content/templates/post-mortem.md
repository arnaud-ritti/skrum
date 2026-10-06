---
summary: A review after an incident, covering what held, what was missing, what each person learned and what will catch the same failure earlier.
related:
  - template: fishbone
    why: To find the cause first, when the team does not yet agree on why the incident happened.
  - template: pre-mortem
    why: The same exercise before the fact, on a failure that can still be prevented.
  - template: original-four
    why: A lighter look back that keeps a column for what was learned, for a sprint in which nothing broke.
---

## What it is

A post-mortem looks back at one event, usually an incident: an outage, a failed release, a deadline badly missed. Its five columns separate what held up, what was missing, what people learned, what will be done about it, and who deserves thanks.

## Goal

Follow-ups, each with an owner, that make the same failure less likely or caught sooner. And a team that has said openly what happened, without anyone being put on trial.

## When to use it

- Soon after the incident is closed, while memories are fresh.
- With everyone who took part in the response.
- Once the timeline is written down. The facts come first; the board is for what they mean.

## When to pick another format

If the team does not yet know why it happened, the columns fill with guesses: look for the cause first with [Fishbone Analysis](../fishbone/). For an ordinary sprint in which nothing broke, this format is heavier than needed; [Original 4](../original-four/) keeps the question about learning. To look for failures before they happen, run a [Pre-mortem](../pre-mortem/).

## How to run it

Open by saying that the session is about the system, not about who made a mistake: people acted on what they knew at the time. Read the timeline together, then:

1. **What we liked**: what held up under pressure? An alert that fired, a runbook that was right, a decision taken fast.
2. **What we missed**: what did the incident show to be absent? Alerts, documentation, access, someone who knew.
3. **What I learned**: what do you know now that you did not know before?
4. **For next time**: what would make us catch this earlier, or limit the damage? Write each card as a follow-up someone could own.
5. **Appreciations**: who carried the incident? Name the person and what they did.

Discuss **What we missed** and **For next time** side by side: each gap should meet a follow-up, or a stated decision to live with it. Turn the follow-ups the team keeps into actions, each with an owner. Close by reading the appreciations aloud.
