<p align="center">
  <img src="doc/omi-mail-brand.svg" width="280" alt="Omi Mail" />
</p>

<p align="center">自己的域名，安静而顺手的邮件工作区。</p>

<p align="center">
  简体中文 · <a href="README-en.md">English</a> ·
  <a href="https://284021.xyz">在线站点</a> ·
  <a href="https://github.com/masoneai/cloud-mail-optimized">源代码</a> ·
  <a href="https://github.com/masoneai/cloud-mail-optimized/issues">反馈</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-087f75" alt="MIT license" /></a>
  <a href="https://github.com/masoneai/cloud-mail-optimized/actions/workflows/ci.yml"><img src="https://github.com/masoneai/cloud-mail-optimized/actions/workflows/ci.yml/badge.svg" alt="Test and build" /></a>
</p>

## Omi Mail

Omi Mail 是由本仓库独立维护的域名邮箱，运行在 Cloudflare Workers 上，使用 Cloudflare Email Routing 收件、Resend 发件。它把多域名和多个邮箱地址放进同一个工作区，提供中文、英文及深色主题，适合管理个人或小团队的域名邮件。

项目采用独立的 Omi Mail 品牌，重新设计登录页、邮箱导航、邮件列表和写信窗口，并重构了邮件解析、发件额度、配置缓存与投递回调。仓库名暂保留 `cloud-mail-optimized`，代码来源和许可证说明见文末。

**[进入 Omi Mail](https://284021.xyz/login)**。这是实际运行的邮箱站点；登录和注册以站点管理员的设置为准，不提供公开的管理员测试账号。

<p align="center">
  <img src="mail-vue/public/image/login-mail-garden.webp" width="560" alt="Omi Mail 登录页的信封与云朵主题插画" />
</p>

## 已实现的体验

- **清爽的邮箱工作区**：青绿与暖白配色，统一导航、邮箱卡片、邮件列表和写信窗口；手机上导航与邮箱列表收为抽屉。
- **顺手的登录**：专属邮件主题插画，用户名按回车进入密码框，密码按回车登录；保留域名选择、自定义背景与已配置的第三方登录。
- **多地址、多域名**：在管理员配置的域名内创建邮箱地址，切换地址时排队刷新，避免旧请求覆盖当前列表。
- **收件和发件**：支持中文邮件、HTML 正文、回复、普通附件及内嵌图片；接入 Resend 后可以查看投递状态。
- **更容易处理邮件**：当前已加载邮件的未读筛选、星标、批量操作、草稿保存；按 **C** 快速写信，输入内容或弹窗内不会触发快捷键。
- **管理与权限**：用户、角色、邮箱和发件额度管理；注册、收件范围及附件存储由管理员控制。

源码还包含可选的 Telegram/Webhook 通知、Turnstile、OAuth、数据统计和 Workers AI 接口。使用这些功能需要另行配置相应服务；它们不因部署前端而自动开启。

## 本仓库的实现特色

| 改进 | 实际行为 |
| --- | --- |
| 静态资源分流 | 页面与前端资源由静态资源服务返回，仅 `/api/*`、`/static/*` 和 `/attachments/*` 优先执行 Worker。 |
| 配置缓存 | 当前 Worker 实例缓存原始配置 30 秒，每次请求独立克隆；管理页面脱敏不会污染发件配置。 |
| 入站邮件解析 | 保持原始邮件字节，避免分块中文乱码和二进制附件损坏；先检查收件人权限，再解析 MIME。 |
| 发件额度预留 | 收件人、附件、内嵌图片和回复归属先校验；通过 D1 条件更新原子预留角色额度。 |
| 回调验签 | 对 Resend 回调的原始正文验签并检查时间戳；忽略非状态事件，迟到通知不会覆盖最终投递状态。 |
| 域名精确匹配 | 域名去空格、小写及去重，兼容 TOML 数组与 JSON 字符串，避免通过子串匹配误放行域名。 |
| 后台任务隔离 | 邮件保存后再执行通知；单项通知或维护任务失败不会跳过其他任务。 |

## 技术与存储

- **前端**：Vue 3、Element Plus、Pinia、Vue Router、Vue I18n、Vite。
- **服务端**：Cloudflare Workers、Hono、Drizzle、PostalMime。
- **数据**：D1 保存用户及邮件数据，KV 保存配置、会话和可选的附件对象。
- **邮件服务**：Cloudflare Email Routing 接收入站邮件，Resend 发送外部邮件。
- **可选存储**：附件默认可使用 KV；按需求绑定 R2 或配置 S3 兼容存储。

无需管理自建服务器，但域名、Cloudflare 与 Resend 均受各自的套餐、配额和计费规则约束。创建多个前缀不等于无限容量或无限发送；项目不承诺永久零成本。

## 本地运行

开发和 CI 使用 **Node.js 24** 与 **pnpm**。前端构建输出到 `mail-worker/dist`，由本地 Worker 一起提供服务。

```sh
git clone https://github.com/masoneai/cloud-mail-optimized.git
cd cloud-mail-optimized
pnpm --dir mail-vue install --frozen-lockfile
pnpm --dir mail-worker install --frozen-lockfile
pnpm --dir mail-vue run build
cd mail-worker
pnpm exec wrangler dev --local --config wrangler-dev.toml --port 8790 --ip 127.0.0.1 --show-interactive-dev-session=false
```

打开 <http://127.0.0.1:8790>。`wrangler-dev.toml` 中的域名、管理员和签名值仅用于本地开发；本地数据库与账号独立于线上环境。首次启动时，需要通过 `/api/init/<本地 jwt_secret>` 初始化数据库，再在本地注册配置中的管理员邮箱并设置密码。

本地预览不会自动获得外部邮件收发能力。不要把开发配置中的示例签名值用于生产环境，也不要向开发邮箱存入真实敏感邮件。

## 部署到 Cloudflare

部署包含网站与邮件服务两部分；仅发布网页还不能收到或发送域名邮件。

1. 在 Cloudflare 准备域名、Worker、D1 和 KV，绑定名分别为 `db`、`kv` 与静态资源的 `assets`。R2 是可选项。
2. 设置邮箱域名数组 `domain`、管理员邮箱 `admin`，并使用自己的 `jwt_secret`。首次部署后，通过 `/api/init/<jwt_secret>` 初始化数据库；此地址含私有密钥，不要公开或存进仓库。
3. 在 Cloudflare Email Routing 配置域名 DNS 与路由，让所需地址或 catch-all 指向该 Worker。实际接受哪些邮箱地址仍取决于站点的收件设置。
4. 注册配置中的管理员邮箱并设置密码，进入系统设置确认注册、收件范围和存储选项。
5. 需要发件时，在 Resend 验证发件域名，创建仅允许该域名发件的 API Key，填入系统的 Resend 配置并开启发件。
6. 需要投递状态时，在 Resend 创建指向 `https://你的站点/api/webhooks` 的回调，并把它的 Signing Secret 保存为 Worker Secret `resend_webhook_secret`。

### GitHub Actions

仓库的 Cloudflare 部署工作流支持手动运行以及前后端源代码推送后部署。它会先检查所需配置，未配置时跳过部署。到 **Settings → Secrets and variables → Actions** 添加：

| 配置 | 存放位置 | 用途 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secrets | Worker、D1、KV 的部署权限 |
| `JWT_SECRET` | Secrets | 自行生成的登录签名密钥 |
| `CLOUDFLARE_ACCOUNT_ID` | Variables | Cloudflare 账号 ID |
| `DOMAIN` | Variables | 域名 JSON 数组，例如 `["example.com"]` |
| `ADMIN` | Variables | 管理员邮箱，例如 `admin@example.com` |

可选配置：`NAME`、`CUSTOM_DOMAIN`、`D1_DATABASE_ID`、`KV_NAMESPACE_ID`、`R2_BUCKET_NAME`、`PROJECT_LINK`。提供已有 D1/KV 的 ID 可复用资源；未提供时工作流按名称查找或创建。`PROJECT_LINK` 可设置为本仓库地址。域名邮件路由、Resend 与回调 Secret 仍须单独配置。

### 命令行部署

以 `mail-worker/wrangler.toml` 为配置模板，填写自己的资源绑定、域名和管理员，移除不使用的可选绑定，然后在 `mail-worker` 目录执行：

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put jwt_secret
pnpm exec wrangler deploy
```

`wrangler.toml` 的构建步骤会安装并构建前端。启用回调时再执行：

```sh
pnpm exec wrangler secret put resend_webhook_secret
```

API Key 与 Webhook Signing Secret 是两种不同密钥。未配置回调签名密钥时，回调返回 503；验签失败返回 401。可参考 [Cloudflare 静态资源路由](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) 与 [Resend 回调验签文档](https://resend.com/docs/webhooks/verify-webhooks-requests)。

## 检查与已知边界

```sh
cd mail-worker
pnpm test
pnpm run check:bundle
cd ../mail-vue
pnpm run build
```

测试覆盖 MIME、域名匹配、发件额度、配置缓存与回调验签等流程；发送服务使用替身，不会向外部邮箱发信。CI 在推送和 Pull Request 时运行 Worker 测试并构建前端。本地数据库、登录信息、私有配置与构建产物不应上传 GitHub。

- 用户角色额度与邮件服务商额度分别计算；每日 KV 发送统计为近似数据。
- 发送网络异常时结果可能未知，因此保留已预留额度，不能保证重试绝不重复发信。
- 配置修改在当前实例立即更新，其他实例的缓存最多保留 30 秒，并受 KV 最终一致性影响。
- D1 与附件存储没有跨服务事务；附件失败会尝试清理本次记录，但极端情况下可能留下对象。
- 未读筛选只作用于当前已加载邮件，可继续加载更早的邮件。

## 来源与许可证

Omi Mail 的代码起点为 [maillab/cloud-mail](https://github.com/maillab/cloud-mail) 的提交 `ec7a2bb`。当前仓库拥有自己的品牌、部署、版本记录、界面设计及上述新增和重构实现，同时保留并继续使用上游的部分接口、数据模型和管理功能。这是一个在开源基础上独立设计与维护的衍生项目，具体来源记录见 [NOTICE.md](NOTICE.md)。

项目源码采用 [MIT 许可证](LICENSE)，保留上游声明 **Copyright (c) 2025 aslost**。发布、修改或分发本项目时，应保留相应版权和许可文本。第三方依赖及随附资源适用各自许可证：例如随附的 [TinyMCE](mail-vue/public/tinymce/license.md) 声明为 GNU GPL v2 或更高版本；其许可证与 notices 均予保留，不纳入本项目的 MIT 授权声明。
