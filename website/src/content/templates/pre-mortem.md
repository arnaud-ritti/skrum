---
summary: Imagine the project has already failed, tell how it happened, and deal with those causes while there is still time.
related:
  - template: post-mortem
    why: The review after a real failure, once there are facts to examine instead of a story.
  - template: raid
    why: A register for the risks found here, beside the assumptions, issues and dependencies.
  - template: hopes-and-fears
    why: A gentler start that asks for fears directly and gives hopes the same room.
---

## What it is

A pre-mortem is run before the work, not after it. The team imagines that the project is over and that it failed, then explains the failure as if looking back. Starting from an imagined failure makes it easier to say what a plain question about risks leaves unsaid.

## Goal

The few causes of failure the team finds most likely, each met by a change to the plan or a safeguard with an owner, before any of them is real.

## When to use it

- Once the plan is concrete enough to fail and before its commitments are hard to change: a kickoff, the eve of a large release, a migration.
- When the plan looks too smooth and nobody voices a doubt.

## When to pick another format

If the failure has already happened, there are facts to study: run a [Post-mortem](../post-mortem/). If the team is new and does not yet speak freely, imagining a disaster is a hard way to begin; [Hopes and Fears](../hopes-and-fears/) asks for worries more gently. To keep following risks through the project, use [RAID Log (Risks, Assumptions, Issues, Dependencies)](../raid/).

## How to run it

Set the scene: name the project, pick a date after its planned end, and say that it failed.

1. **(Hypothetically) The project failed! What went wrong?** Tell how it happened, in the past tense, one cause per card.
2. **What didn't we do?** Which step did we skip on the way there?
3. **What current problems remain?** What exists today, for real, that would make this failure worse?
4. **Any other concerns?** Anything that nags at you and belongs to no one.

Group the stories of failure: a cause told by several people is the signal. Vote for the causes that are both likely and costly. For the groups that come out on top, decide in the discussion what changes in the plan now, and record each change as an action with an owner. The cards of **What current problems remain?** need no imagination: they are already true, so give them an owner first.
