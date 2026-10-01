# Webhook payload history and redelivery — design

**Status:** draft for review · **Date:** 2026-10-01 · **Parent:** `docs/superpowers/specs/2026-09-30-integrations-extended-design.md` (spec 8, §4.5–§4.7)

## 1. Purpose

Spec 8 gave generic outgoing webhooks retries and a delivery log, but explicitly left out redelivery because payloads were not stored (§2, non-goals). This spec adds, for generic outgoing webhooks only:

- a **payload viewer**: Owners/Admins see the exact request skrum sent (headers and body) and an excerpt of the receiver's response, to debug their receiver;
- a **Redeliver** action, like GitHub's: resend a past delivery unchanged so a receiver that was down or broken can catch up.

**Success:** an Owner/Admin opens the webhook's delivery log, views any delivery from the last 30 days, and redelivers it; the receiver gets the same `id`, `event`, `occurredAt` and `data`, a valid signature and a redelivery header; payload content disappears after 30 days while the log row stays 90 days; everything below is covered by a feature test; suite, phpstan, type-check and lint stay green; no new Composer or npm dependency.

## 2. Scope

**In:** deliveries to a generic outgoing webhook (`IntegrationProvider::Webhook`): manual shares (`retro_link`, `poker_link`, `retro_results`, `game_room_link`) and automatic events (`event`), plus redeliveries themselves.

**Out:**
- Test messages (`WebhookMessage::test()`): never stored, never redeliverable.
- Slack, Telegram, Microsoft Teams and Mattermost deliveries; email.
- Inbound tracker webhooks (Jira, Linear, GitHub).
- Automatic redelivery of failed rows, and a bulk "redeliver all failed" action.
- Deliveries made before this feature ships (no stored content).

## 3. Data

New table `integration_delivery_payloads` (up-only migration):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, primary | |
| `integration_delivery_id` | uuid, unique, foreign key → `integration_deliveries`, cascade on delete | one payload per delivery |
| `message` | text, encrypted (`encrypted:array` cast) | the message parts: `id`, `event`, `occurredAt`, `data` |
| `request_headers` | text, encrypted (`encrypted:array`), nullable | headers of the last attempt; `X-Skrum-Signature` stored masked (§4) |
| `request_body` | text, encrypted, nullable | exact body bytes of the last attempt |
| `response_status` | unsigned smallint, nullable | |
| `response_excerpt` | text, encrypted, nullable | first 2 048 bytes of the last response body, as received |
| `created_at`, `updated_at` | timestamps | |

`integration_deliveries` gains `redelivery_of_id` (nullable uuid, indexed, foreign key → `integration_deliveries`, null on delete). A redelivery keeps the original's `kind` and `event`; `redelivery_of_id` marks it as a redelivery.

**Never stored:** the signing secret, the webhook URL, the full signature.

**Size limit:** When the message, counted twice (the body repeats it) plus 4 KB of envelope, exceeds 512 KB, no payload row is written when the delivery is queued and the delivery shows "Content not kept". (Recaps are already capped well below this.)

**Retention:** `IntegrationDeliveryPayload` is prunable after **30 days** (`created_at`) through the existing daily `model:prune`. The delivery row keeps its 90-day retention and its metadata (event, status, attempts, response status, error). The payload copied for a redelivery keeps the `created_at` of the payload it was copied from, so content never outlives 30 days from the first delivery: a redelivery made on day 29 can be viewed and redelivered for one more day.

**Storage failures:** keeping the message is a courtesy for the log. When it cannot be stored for a share or an automatic event (encoding or database error), the delivery is still queued and shows "Content not kept"; only the class of the error is reported. For a redelivery, which cannot work without content, the failure is fatal.

## 4. Behaviour

### 4.1 Storing payloads

- When a webhook delivery is created (`QueueShare`, `QueueWebhookEvents`, redelivery), its payload row is created in the same transaction with `message` filled.
- `WebhookClient::send()` updates `request_headers`, `request_body`, `response_status` and `response_excerpt` after each attempt (the last attempt wins; an attempt that fails before anything is sent, such as an unsafe URL, clears the stored request and response).
- The stored `X-Skrum-Signature` is masked: `sha256=…` followed by its last 6 characters. An echoed signature in the response excerpt is masked the same way. All other headers are stored as sent (`Content-Type`, `Accept`, `User-Agent`, `X-Skrum-Event`, `X-Skrum-Delivery`, `X-Skrum-Timestamp`, `X-Skrum-Redelivery`).
- Reading the response: at most 2 048 bytes are read and kept; the rest is discarded unread, as today. The excerpt is collected from curl's write callback; with faked HTTP the response body stands in for it. The address pinning and redirect refusal of spec 8 §4.5 are unchanged.

### 4.2 Redeliver

`POST …/integrations/{integration}/deliveries/{delivery}/redelivery` by an Owner/Admin:

1. Checks eligibility (§4.3); refuses with **409** and the reason otherwise.
2. Creates a new delivery row: same `team_id`, `channel`, `kind`, `event`, `subject_type`/`subject_id`; `team_integration_id` = the current webhook connection; `redelivery_of_id` = the root original (a redelivery of a redelivery points to the first delivery of the chain); `requested_by_user_id` = the current user; status `queued`.
3. Copies the original's `message` into the new payload row, which keeps the `created_at` of the payload it was copied from (§3, retention).
4. Queues `RedeliverWebhook` for the new row with the normal share retries (4 tries, backoff 10 s, 60 s, 300 s). When the job cannot be queued, the new row is marked failed ("The message could not be delivered."), the error is reported and the request answers **503** "The redelivery could not be queued. Try again.", so the row never stays `queued` without a job.
5. Answers **202** with the presented new delivery.

When sent, the redelivery:
- rebuilds the body from the stored message: same `id`, `event`, `occurredAt`, `data`; a fresh `sentAt`; the team's current `{id, name}`;
- signs it with the webhook's **current** secret and a fresh `X-Skrum-Timestamp`;
- sends `X-Skrum-Delivery: <original message id>` and `X-Skrum-Redelivery: true`;
- goes to the webhook's **current** URL after the same `SafeWebhookUrl` checks as any send (all addresses public unless allowed, pinned, no redirects);
- counts toward webhook health like any delivery (`WebhookHealth::succeeded/failed`, auto-disable after 10 consecutive failures);
- is applied by nobody inside skrum: redelivering `action_item.completed` resends the historical event only; it never changes an action item and never triggers status sync.

### 4.3 Eligibility

A delivery can be redelivered when all hold:
- it belongs to this team's webhook log (`team_id` and channel `webhook`, across reconnections) (else **404**);
- its payload row still exists (else **409** "This delivery's content is no longer kept.");
- its status is `sent` or `failed`, or it has been `queued` for more than 6 hours (a `queued` original is still retrying: **409** "This delivery is still being sent.");
- the webhook integration is active (else **409** "Turn the webhook back on before redelivering.");
- no redelivery of the same root original has been queued in the last 6 hours and is still `queued` (the guard is per root) (else **409** "This delivery is already being redelivered.").

**Stale rows:** a row still `queued` more than 6 hours after its creation lost its job (the longest retry schedule, an automatic event's, lasts 3 h 42 min 30 s, plus the time each attempt waits on the queue). Both guards ignore such rows, so a lost job never blocks redelivery for good. The row itself is left as it is. The log exposes `redeliverable: bool` per row (content kept and not still being sent, by the same rule), and the interface offers **Redeliver** from it.

### 4.4 Viewing

`GET …/integrations/{integration}/deliveries/{delivery}` by an Owner/Admin returns:

```json
{
  "id": "…", "event": "action_item.completed", "status": "failed", "attempts": 4,
  "redeliveryOf": null,
  "request": { "headers": { "X-Skrum-Signature": "sha256=…a1b2c3", "…": "…" }, "body": "{…}" },
  "response": { "status": 500, "excerpt": "Internal Server Error" }
}
```

**404** when the delivery is not this integration's, its payload has been pruned, or its content can no longer be decrypted. The existing paginated log (`…/deliveries`) gains `hasContent: bool`, `redeliverable: bool` and `redeliveryOf: ?string` per row.

## 5. Permissions and limits

- View and redeliver: Owners/Admins only (`TeamPolicy::manageIntegrations`), checked before validation and before any lookup that could reveal existence. Members and guests get **403**.
- Both routes sit behind `EnsureIntegrationProviderEnabled` for `webhook` (404 when the provider is off) and `scopeBindings()`.
- Throttles: redeliver `throttle:10,1,webhookRedeliveries` per user; view shares the existing `throttle:60,1,webhookDeliveries`.
- Payload contents, headers and response excerpts never appear in logs or exception messages. Share and event jobs are encrypted on the queue (`ShouldBeEncrypted`), so `failed_jobs` never holds their message in clear; the redelivery job carries the delivery id only.

## 6. Interface

On the webhook card's deliveries panel (`webhook-deliveries-panel.tsx`):
- each row with `hasContent` shows **View** and, when eligible, **Redeliver**;
- rows without content show "Content no longer kept" (or "Content not kept" when it was never stored);
- redeliveries are labelled "Redelivery";
- redeliveries are excluded from the share lines on the retro, poker and game pages (`LatestDeliveries`), which keep showing the original share; a redelivery's outcome shows in the webhook log only;
- **View** opens a dialog with two tabs: *Request* (headers table, pretty-printed JSON body, copy button) and *Response* (status and excerpt as plain text);
- **Redeliver** asks "Send this delivery again to :host?"; on success the panel reloads its first page; a 409 shows its message inline.

Every new string exists in `lang/{en,fr,es,de}.json`.

## 7. Errors

| Situation | Result |
|---|---|
| Payload pruned or never stored | View 404; Redeliver 409 "This delivery's content is no longer kept." |
| Original still queued (for less than 6 hours) | 409 "This delivery is still being sent." |
| Content that can no longer be decrypted | View 404; Redeliver 409 "This delivery's content is no longer kept."; a queued redelivery fails with "This delivery's content is no longer kept." without counting toward the automatic disabling |
| Redelivery job cannot be queued | 503 "The redelivery could not be queued. Try again."; the new row is marked failed; the delivery can be redelivered again |
| Webhook disabled | 409 "Turn the webhook back on before redelivering." |
| Redelivery already queued (for less than 6 hours) | 409 "This delivery is already being redelivered." |
| URL now unsafe (private address, bad shape) | The new row fails with spec 8's unsafe-URL message; the original is unchanged |
| Receiver 410 | Webhook disabled as gone (spec 8 §4.7), same as any delivery |
| Too many redeliveries | 429 |

## 8. Testing

Pest feature tests with `Http::fake()` and `Http::preventStrayRequests()`:
- a share and an automatic event each store an encrypted payload (raw column is not plaintext); the signature header is masked; a test message stores nothing;
- the response excerpt keeps at most 2 048 bytes;
- pruning deletes payloads older than 30 days and keeps the delivery row; a redelivery made on day 29 loses its content on day 30 of the first delivery;
- viewing: Owner/Admin 200 with the documented shape; member and guest 403; another integration's delivery 404; pruned 404; provider disabled 404;
- redelivery: same `id`/`event`/`occurredAt`/`data`, fresh `sentAt`, valid signature with the current secret, `X-Skrum-Delivery` = original id, `X-Skrum-Redelivery: true`, new row linked by `redelivery_of_id`, payload copied;
- refusals: pruned, still queued, webhook disabled, redelivery already queued (409 each with its message); throttle 429; a row queued more than 6 hours ago no longer blocks; a redelivery whose job cannot be queued ends failed with 503;
- a redelivery whose content disappeared fails with "This delivery's content is no longer kept." without counting toward the automatic disabling;
- a failed redelivery counts toward auto-disable; a successful one resets the counter;
- an unsafe current URL fails the new row without touching the original;
- redelivering `action_item.completed` changes no action item and queues no status push;
- no payload content appears in a failed job's payload (the redelivery job carries the delivery id only; share and event jobs are encrypted);
- translation keys exist in all four languages.

Manual walkthrough: point a webhook at a request inspector, complete an action item, view the delivery, stop the receiver, complete another, see it fail, restart the receiver, redeliver it, and see the same id with `X-Skrum-Redelivery: true` arrive.
