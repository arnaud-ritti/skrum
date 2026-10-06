---
title: "Summary and sharing"
description: "Read the summary of a finished retrospective and send its results."
order: 12
related:
  - retrospectives/roti-and-close
  - retrospectives/actions
  - action-items/track
  - integrations/overview
---

A completed retrospective keeps its results: figures, action items, ROTI, top topics. This page covers the summary a language model can add, sending the results by email or to a chat channel, and where to find a retro afterwards.

## What every completed retro shows

Open the retro. Its **Results** tab shows the action items created, the participation, the cards, groups and votes, the average ROTI, the top topics, the results of the surveys and of the health check if there were any, and the people who took part. The **Board** tab shows the columns as they were. [ROTI and close](../roti-and-close/) has a picture of it.

Without a language model on the instance, that is all: there is no **Summary** card.

## The summary, with a language model

When the instance has a language model configured, the results gain a **Summary** card.

![The Summary card of a completed retro: the text, the provider, a theme with its cards, and two suggested actions](../../../assets/screenshots/retrospectives/summary.png)

- With **Automatic AI summary** on in the session settings, the summary is requested as soon as the retro is completed. The card reads **Generating the summary…** until it is ready.
- With it off, nothing is sent. The facilitator sees **Generate summary** on the card, with the name of the provider the board content would be sent to, and decides.

The card then holds:

- a short text, signed **Generated with** and the name of the provider;
- **Themes**: the cards the model put together, each with the mood and the category the model gave it;
- **Suggested actions**, to **Promote** into action items or **Reject**, see [Actions](../actions/).

The facilitator can **Regenerate** the summary or **Remove** it. If the request fails, the card says that the summary could not be generated and offers **Retry**.

> To write the summary, the content of the board is sent to the provider configured for the instance. Turn **Automatic AI summary** off before the end of the retro to keep it on your server.

## Send the results by email

The facilitator of the retro, if they are a member of the team, and the workspace's owners and admins can send the results. The button is there when the instance can send mail: see [Mail](../../administration/mail/).

1. On the completed retro, select **Send the recap by email**.
2. Choose the recipients: **Participants with an account** or **All team members**. Guests have no account and are never emailed.
3. Select **Send**.

![The Email the results dialog, with its two groups of recipients](../../../assets/screenshots/retrospectives/send-results.png)

Each person receives the figures of the session, the action items with their owners, the ROTI, the summary if there is one, and a button that opens the retro. The mail is written in the language of the person who receives it. A second send is refused for ten minutes after the first.

## Send the results to a channel

When the team has a chat integration connected, the same people have a **Share** menu on the completed retro, with one entry per channel, such as **Share to Slack**.

1. Select **Share**, then the channel.
2. Read what the recap includes: the title, the date and the participants; the number of cards and the average ROTI; the summary when there is one; the action items with their assignees; the suggested actions still pending; the top card of each column.
3. Select **Send**.

Card authors, votes and comments are never shared. [Integrations](../../integrations/overview/) lists the channels and how to connect them.

## Find a finished retro

- The team page lists the latest ones under **Recent sessions**.
- **Sessions**, in the sidebar, lists all the sessions of the team; filter on the retros.
- The action items the retro produced are on the team's action items page, see [Track action items](../../action-items/track/).
