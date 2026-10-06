---
summary: One problem, its possible causes sorted into five families, and fixes that answer the causes rather than the symptom.
related:
  - template: post-mortem
    why: For an incident whose cause is known, to go straight to the gaps and the follow-ups.
  - template: pre-mortem
    why: The same search for causes, pointed at a failure that has not happened yet.
  - template: went-well-to-improve-actions
    why: A general look back, when there is no single problem to take apart.
---

## What it is

A fishbone analysis takes one problem and asks where its causes lie. The picture is a fish skeleton: the problem is the head, and each large bone is a family of causes. Here five columns are the bones, and a sixth collects the solutions.

## Goal

An agreed account of why the problem happens, wide enough that the team did not stop at the first cause it thought of, and a few fixes aimed at those causes.

## When to use it

- A problem that keeps coming back: the same kind of bug, releases that slip, a handover that fails again.
- After an incident whose cause is disputed.
- With a team that jumps to a fix: the columns make it look in five places first.

## When to pick another format

Without a single problem, the columns have nothing to hold: for a general look back, use [Went well, To improve, Action ideas](../went-well-to-improve-actions/). After an incident whose cause is already known, [Post-mortem](../post-mortem/) goes straight to the gaps and the follow-ups. For a failure that has not happened yet, run a [Pre-mortem](../pre-mortem/).

## How to run it

Agree on the problem in one sentence before anyone writes a card. Then ask the same question at each of the first five columns: what here contributes to it?

1. **People**: skills, staffing, knowledge held by one person. Describe the situation, do not name a culprit.
2. **Process**: how the work is done. A step skipped, a rule nobody wrote down.
3. **Tools**: alerts, tests or environments that are missing or misleading.
4. **Program**: planning. Scope, funding, deadlines.
5. **Environment**: what lies outside the team. Vendors, traffic, changes in the organisation.
6. **Solutions**: the fixes you already have in mind for the causes you wrote.

Group the causes, and for the larger groups ask "why?" again until the answer is something the team can change. Vote on the causes that matter most. In the discussion, set the cards of **Solutions** against the chosen causes and keep the fixes that answer one of them, each as an action with an owner.
