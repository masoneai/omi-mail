<p align="center">
  <img src="doc/omi-mail-brand.svg" width="280" alt="Omi Mail" />
</p>

<p align="center">Your domain. A calm, practical place for your mail.</p>

<p align="center">
  <a href="README.md">简体中文</a> · English ·
  <a href="https://284021.xyz">Website</a> ·
  <a href="https://github.com/masoneai/omi-mail">Source</a> ·
  <a href="https://github.com/masoneai/omi-mail/issues">Issues</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-087f75" alt="MIT license" /></a>
  <a href="https://github.com/masoneai/omi-mail/actions/workflows/ci.yml"><img src="https://github.com/masoneai/omi-mail/actions/workflows/ci.yml/badge.svg" alt="Test and build" /></a>
</p>

## Omi Mail

Omi Mail is an independently maintained domain email application running on Cloudflare Workers. It receives mail through Cloudflare Email Routing and sends mail through Resend. Multiple domains and addresses share one workspace, with Chinese, English and dark themes for personal or small-team domain email.

This repository uses its own Omi Mail brand, redesigned login, navigation, message list and composer, and reworked mail parsing, sending allowances, configuration caching and delivery callbacks. The repository is named `omi-mail`, matching the Omi Mail identity; its origins and license are explained below.

**[Open Omi Mail](https://284021.xyz/login)**. This is an operating email website. Login and registration follow the administrator's settings; there is no public administrator demo account.

<p align="center">
  <img src="mail-vue/public/image/login-mail-garden.webp" width="560" alt="Envelope and cloud illustration used on the Omi Mail login page" />
</p>

## What is implemented

- **A clear workspace**: teal and warm white colors, consistent navigation, address cards, message lists and composer. On phones, navigation and address lists move into drawers.
- **Keyboard-friendly login**: a dedicated mail illustration; Enter in the username field advances to the password, and Enter in the password field submits. Domain selection, custom backgrounds and configured OAuth providers remain available.
- **Multiple addresses and domains**: create addresses within the administrator's configured domains. Queued refreshes prevent an old request from replacing messages after an address switch.
- **Receiving and sending**: Chinese text, HTML mail, replies, attachments and inline images. Connecting Resend enables outbound mail and delivery status.
- **Everyday mail tools**: unread filtering for loaded messages, stars, bulk actions and saved drafts. Press **C** to compose; typing and open dialogs do not trigger the shortcut.
- **Administration**: users, roles, addresses and sending allowances. Registration, accepted recipients and attachment storage are administrator-controlled.

The source also includes optional Telegram/Webhook notifications, Turnstile, OAuth, statistics and Workers AI integration. These require their corresponding services to be configured and are not automatically enabled by deploying the frontend.

## Changes in this repository

| Change | Behavior |
| --- | --- |
| Static asset routing | Pages and frontend assets use the static asset service. Only `/api/*`, `/static/*` and `/attachments/*` run the Worker first. |
| Configuration cache | Each Worker instance caches raw settings for 30 seconds and clones them for each request. Redacting secrets in administration responses does not alter sending settings. |
| Inbound parsing | Original message bytes are preserved to avoid broken multibyte text and binary attachments. Recipient permissions are checked before MIME parsing. |
| Sending reservations | Recipients, attachments, inline images and reply ownership are validated before sending. Conditional D1 updates reserve role allowances atomically. |
| Verified callbacks | Resend callbacks are checked against the raw body signature and timestamp. Non-status events are ignored, and late events do not replace final delivery states. |
| Exact domain matching | Domains are trimmed, lowercased and deduplicated. TOML arrays and JSON strings are supported without substring-based authorization. |
| Isolated background work | Notifications run after mail is saved. One failed notification or maintenance task does not skip the others. |

## Technology and storage

- **Frontend**: Vue 3, Element Plus, Pinia, Vue Router, Vue I18n and Vite.
- **Backend**: Cloudflare Workers, Hono, Drizzle and PostalMime.
- **Data**: D1 stores users and messages; KV stores settings, sessions and optional attachment objects.
- **Email**: Cloudflare Email Routing for inbound mail; Resend for external sending.
- **Optional storage**: attachments can use KV, a bound R2 bucket or configured S3-compatible storage.

There is no server to manage, but domains, Cloudflare and Resend each have their own plans, limits and billing rules. Multiple address prefixes do not mean unlimited storage or sending. The project does not promise permanent zero-cost operation.

## Run locally

Development and CI use **Node.js 24** and **pnpm**. The frontend builds into `mail-worker/dist`, served together with the local Worker.

```sh
git clone https://github.com/masoneai/omi-mail.git
cd omi-mail
pnpm --dir mail-vue install --frozen-lockfile
pnpm --dir mail-worker install --frozen-lockfile
pnpm --dir mail-vue run build
cd mail-worker
pnpm exec wrangler dev --local --config wrangler-dev.toml --port 8790 --ip 127.0.0.1 --show-interactive-dev-session=false
```

Open <http://127.0.0.1:8790>. Domains, the administrator address and the signing value in `wrangler-dev.toml` are development examples. Local accounts and data are separate from production. On first use, initialize the database through `/api/init/<local jwt_secret>`, then register the configured administrator address locally and choose its password.

A local preview does not automatically receive or send external mail. Do not use the example signing value in production or store real sensitive messages in a development mailbox.

## Deploy to Cloudflare

Website deployment and email configuration are separate steps. Publishing the website alone does not enable inbound or outbound domain mail.

1. Prepare a Cloudflare domain, Worker, D1 database and KV namespace. Use `db`, `kv` and `assets` as the database, KV and static asset binding names. R2 is optional.
2. Configure the `domain` array, `admin` address and your own `jwt_secret`. After the first deployment, initialize the database through `/api/init/<jwt_secret>`. This URL contains a private secret; do not publish or commit it.
3. Set up DNS and Cloudflare Email Routing so the required addresses or catch-all route point to this Worker. Accepted addresses still depend on the application's receiving settings.
4. Register the configured administrator address, choose its password, and review registration, recipient and storage settings.
5. To send mail, verify the sending domain in Resend, create an API key restricted to sending for that domain, add it to the application's Resend settings and enable sending.
6. To receive delivery status, create a Resend callback to `https://your-site/api/webhooks` and store its Signing Secret as the Worker Secret `resend_webhook_secret`.

### GitHub Actions

The Cloudflare deployment workflow supports manual runs and deployments after frontend or backend source pushes. It checks required settings first and skips deployment if they are missing. In **Settings → Secrets and variables → Actions**, add:

| Setting | Location | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secrets | Worker, D1 and KV deployment permissions |
| `JWT_SECRET` | Secrets | Your generated login signing secret |
| `CLOUDFLARE_ACCOUNT_ID` | Variables | Cloudflare account ID |
| `DOMAIN` | Variables | A JSON domain array, for example `["example.com"]` |
| `ADMIN` | Variables | Administrator address, for example `admin@example.com` |

Optional settings include `NAME`, `CUSTOM_DOMAIN`, `D1_DATABASE_ID`, `KV_NAMESPACE_ID`, `R2_BUCKET_NAME` and `PROJECT_LINK`. Existing D1/KV IDs reuse those resources; otherwise the workflow finds or creates them by name. `PROJECT_LINK` can point to this repository. Email Routing, Resend and the callback Secret still require separate configuration.

### Command-line deployment

Use `mail-worker/wrangler.toml` as a template. Fill in your resource bindings, domains and administrator address, remove unused optional bindings, then run from `mail-worker`:

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put jwt_secret
pnpm exec wrangler deploy
```

The build command in `wrangler.toml` installs and builds the frontend. If callbacks are enabled, also run:

```sh
pnpm exec wrangler secret put resend_webhook_secret
```

The sending API key and Webhook Signing Secret are different credentials. Callbacks return 503 when the signing secret is not configured, and 401 when verification fails. See [Cloudflare static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) and [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

## Checks and current limits

```sh
cd mail-worker
pnpm test
pnpm run check:bundle
cd ../mail-vue
pnpm run build
```

Tests cover MIME handling, domain matching, sending reservations, configuration caching and callback verification. Sending services use test doubles and do not send to external mailboxes. CI runs Worker tests and builds the frontend on pushes and pull requests. Local databases, login credentials, private configuration and build output should not be uploaded to GitHub.

- Role allowances and email provider allowances are counted separately. Daily sending statistics in KV are approximate.
- A sending network failure can leave the outcome unknown, so its reservation is retained. Retrying is not guaranteed to avoid duplicate sending.
- A settings change refreshes the current instance immediately. Other instances retain their cache for up to 30 seconds and are also subject to KV eventual consistency.
- D1 and attachment storage do not share a transaction. Failed attachment writes trigger cleanup attempts, but objects can remain in exceptional cases.
- Unread filtering applies to currently loaded messages; older messages can be loaded separately.

## Origins and license

Omi Mail started from [maillab/cloud-mail](https://github.com/maillab/cloud-mail), commit `ec7a2bb`. This repository has its own brand, deployment, version history, interface design and the additions and reworked implementations described above. It also retains parts of the upstream APIs, data models and administration features. This is an independently designed and maintained derivative project. Source details are recorded in [NOTICE.md](NOTICE.md).

The project's source uses the [MIT license](LICENSE) and retains the upstream notice **Copyright (c) 2025 aslost**. Preserve applicable copyright and license texts when publishing, modifying or distributing it. Third-party dependencies and bundled assets retain their own licenses. For example, the bundled [TinyMCE license](mail-vue/public/tinymce/license.md) specifies GNU GPL v2 or later; its license and notices are retained and are not covered by this project's MIT license statement.
