<p align="center">
    <img src="doc/demo/logo.png" width="80px" />
    <h1 align="center">Cloud Mail</h1>
    <p align="center">基于 Cloudflare 的简约响应式邮箱服务，支持邮件发送、附件收发 🎉</p> 
    <p align="center">
        简体中文 | <a href="/README-en.md" style="margin-left: 5px">English </a>
    </p>
    <p align="center">
        <a href="https://github.com/maillab/cloud-mail/tree/main?tab=MIT-1-ov-file" target="_blank" >
            <img src="https://img.shields.io/badge/license-MIT-green" />
        </a>    
        <a href="https://github.com/maillab/cloud-mail/releases" target="_blank" >
            <img src="https://img.shields.io/github/v/release/maillab/cloud-mail" alt="releases" />
        </a>  
        <a href="https://github.com/maillab/cloud-mail/issues" >
            <img src="https://img.shields.io/github/issues/maillab/cloud-mail" alt="issues" />
        </a>  
        <a href="https://github.com/maillab/cloud-mail/stargazers" target="_blank">
            <img src="https://img.shields.io/github/stars/maillab/cloud-mail" alt="stargazers" />
        </a>  
        <a href="https://github.com/maillab/cloud-mail/forks" target="_blank" >
            <img src="https://img.shields.io/github/forks/maillab/cloud-mail" alt="forks" />
        </a>
    </p>
    <p align="center">
        <a href="https://trendshift.io/repositories/20459" target="_blank" >
            <img src="https://trendshift.io/api/badge/repositories/20459" alt="trendshift" >
        </a>
    </p>
</p>


## 项目简介

只需要一个域名，就可以创建多个不同的邮箱，类似各大邮箱平台，本项目支持署到 Cloudflare Workers ，降低服务器成本，搭建自己的邮箱服务

## 本地优化版本

本版本基于上游 `ec7a2bb` 重构邮件处理、发信额度、配置读取和回调校验，继续使用 Cloudflare Workers、D1、KV 与 Resend。

- **节省 Worker 请求**：网页和前端资源直接由静态资源服务返回，仅 `/api/*`、`/static/*` 和 `/attachments/*` 先执行 Worker。
- **减少 KV 配置读取**：当前 Worker 实例缓存原始配置 30 秒；每个请求独立克隆，设置页面的密钥脱敏不会污染发送流程。
- **可靠解析入站邮件**：原始邮件保持字节格式，避免分块中文乱码和二进制附件损坏；先检查收件人权限，再解析 MIME。
- **发件先校验**：收件人、普通附件、内嵌图片及回复归属在调用发送服务前检查。角色额度通过 D1 条件更新原子预留，避免并发突破余额。
- **安全回调**：Resend 回调验证原始正文签名与时间戳；忽略打开、点击等非状态事件，迟到通知不会将最终状态改回待投递。
- **多域名精确匹配**：兼容 TOML 数组和 JSON 字符串，统一去空格、小写及去重，修复子串域名被误允许的问题，并兼容旧的大小写 Resend Token 键。
- **通知及定时任务隔离**：Telegram/Webhook 通知在邮件保存后执行，失败不会阻止收件；午夜任务使用计划时间，单项失败不跳过后续维护任务。

### 邮箱工作区

前端采用青绿与暖白的工作区，保留原有中文、英文、深色主题与管理权限。导航、邮箱卡片、邮件列表及写信窗口使用统一布局，手机上导航和邮箱列表收为抽屉。

- 按 **C** 快速写信；输入内容或打开弹窗时不会触发快捷键。
- 未读筛选作用于**当前已加载邮件**，可继续加载更早的邮件；选择和批量操作与筛选同步。
- 空收件箱提供写信、复制邮箱入口；创建地址时实时预览前缀与域名。
- 切换邮箱时排队刷新，避免旧账号的异步结果覆盖当前列表；离开收件箱时停止自动轮询。
- 写信窗口支持键盘、焦点恢复与草稿保存，编辑器重建时保留正文，并提供加载失败重试。

本地预览先在 `mail-vue` 运行 `pnpm install --frozen-lockfile`、`pnpm run build`，再在 `mail-worker` 运行：

```sh
pnpm exec wrangler dev --local --config wrangler-dev.toml --port 8790 --ip 127.0.0.1 --show-interactive-dev-session=false
```

打开 `http://127.0.0.1:8790`。本地数据库与账号独立于线上服务；真正收发外部邮件仍需配置域名路由与 Resend。

### 验证与部署

开发和测试使用 Node.js 24 与 pnpm；测试使用真实 MIME 解析和 SQLite，发送服务用替身测试，不会向外部邮箱发信。

```sh
cd mail-worker
pnpm install --frozen-lockfile
pnpm test
pnpm run check:bundle
```

`pnpm test` 现在只运行测试。原来的测试环境部署命令改为 `pnpm run deploy:test`；正式部署仍为 `pnpm run deploy`。

### GitHub 与线上部署

GitHub 仓库保存源代码和版本记录。`CI` 工作流在推送和 Pull Request 时使用 Node.js 24 检查邮件服务测试、构建邮箱前端；本地数据库、登录账号、截图、构建产物及私有环境文件不会上传。

线上邮箱由 Cloudflare Workers 运行。仓库的 Cloudflare 部署工作流保留自动推送部署与手动运行入口，只有必要配置齐全后才执行。先在仓库 **Settings → Secrets and variables → Actions** 配置：

| 配置 | 存放位置 | 用途 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secrets | Worker、D1、KV 的部署权限 |
| `CLOUDFLARE_ACCOUNT_ID` | Variables | Cloudflare 账号 ID |
| `JWT_SECRET` | Secrets | 自行生成的登录签名密钥 |
| `DOMAIN` | Variables | 邮箱域名 JSON 数组，例如 `["example.com"]` |
| `ADMIN` | Variables | 管理员邮箱，例如 `admin@example.com` |

`NAME`、`CUSTOM_DOMAIN`、`D1_DATABASE_ID`、`KV_NAMESPACE_ID`、`R2_BUCKET_NAME` 为可选配置。已有 D1/KV 可提供 ID；未提供时工作流会按名称查找或创建。启用附件对象存储时填写 R2 Bucket，并按上游文档配置权限。完成后在 **Actions** 中运行 Cloudflare 部署工作流，或推送更新。

域名邮件路由与 Resend 发信配置仍需在对应平台完成；回调签名密钥见下文。`mail-vue/.env.remote` 是连接上游演示站的示例，使用 `pnpm remote` 前应换成自己的服务地址；生产构建默认访问同站 `/api`。

按原部署流程绑定 `db`、`kv`，设置 `domain`、`admin` 与自己的 `jwt_secret`，配置邮件路由。启用 Resend 状态回调还需在 Cloudflare Worker 的 **Secrets** 添加 `resend_webhook_secret`，其值取自 Resend 对应 Webhook 的 Signing Secret（`whsec_...`）。回调地址仍为 `https://你的邮箱网站/api/webhooks`。

命令部署可在配置好 Worker 后添加密钥：

```sh
pnpm exec wrangler secret put resend_webhook_secret
```

未设置签名密钥时回调返回 503；未通过验签返回 401。不要把 Signing Secret 当作 Resend 发信 API Key。签名流程参考 [Resend 官方文档](https://resend.com/docs/webhooks/verify-webhooks-requests)，静态资源分流参考 [Cloudflare 官方文档](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)。

### 当前边界

用户角色额度与 Resend 团队的免费额度是两种计数，仍需遵守服务商限制；每日 KV 发送统计为近似数据。发送遇到网络异常时结果可能未知，因此保留已预留额度，不能保证重试绝不重复发信。

配置修改在当前实例立即更新；其他实例最多保留 30 秒本地缓存，且受 KV 最终一致性影响。D1 与对象存储没有跨服务事务：附件保存失败会尝试清理本次邮件及已登记附件，但尚未登记的已上传对象可能残留。

## 项目展示

- [在线演示](https://skymail.ink)<br>
- [部署文档](https://doc.skymail.ink)<br>

| ![](/doc/demo/demo1.png) | ![](/doc/demo/demo2.png) |
|-----------------------|-----------------------|
| ![](/doc/demo/demo3.png) | ![](/doc/demo/demo4.png) |




## 功能介绍

- **💰 低成本使用**： 可部署到 Cloudflare Workers 降低服务器成本

- **💻 响应式设计**：响应式布局自动适配PC和大部分手机端浏览器

- **📧 邮件发送**：集成Resend发送邮件，支持群发，内嵌图片和附件发送，发送状态查看

- **🛡️ 管理员功能**：可以对用户，邮件进行管理，RABC权限控制对功能及使用资源限制

- **📦 附件收发**：支持收发附件，使用R2对象存储保存和下载文件

- **🔔 邮件推送**：接收邮件后可以转发到TG机器人或其他服务商邮箱

- **📡 开放API**：支持使用API批量生成用户，多条件查询邮件 

- **🔢 验证码识别**：使用Workers AI，自动识别邮件验证码 

- **📈 数据可视化**：使用ECharts对系统数据详情，用户邮件增长可视化显示

- **🎨 个性化设置**：可以自定义网站标题，登录背景，透明度

- **🤖 人机验证**：集成Turnstile人机验证，防止人机批量注册

- **📜 更多功能**：正在开发中...



## 技术栈

- **平台**：[Cloudflare Workers](https://developers.cloudflare.com/workers/)

- **Web框架**：[Hono](https://hono.dev/)

- **ORM：**[Drizzle](https://orm.drizzle.team/)

- **前端框架**：[Vue3](https://vuejs.org/) 

- **UI框架**：[Element Plus](https://element-plus.org/) 

- **邮件推送：** [Resend](https://resend.com/)

- **缓存**：[Cloudflare KV](https://developers.cloudflare.com/kv/)

- **数据库**：[Cloudflare D1](https://developers.cloudflare.com/d1/)

- **文件存储**：[Cloudflare R2](https://developers.cloudflare.com/r2/)

## 目录结构

```
cloud-mail
├── mail-worker				    # worker后端项目
│   ├── src                  
│   │   ├── api	 			    # api接口层			
│   │   ├── const  			    # 项目常量
│   │   ├── dao                 # 数据访问层
│   │   ├── email			    # 邮件处理接收
│   │   ├── entity			    # 数据库实体
│   │   ├── error			    # 自定义异常
│   │   ├── hono			    # web框架配置、拦截器、全局异常等
│   │   ├── i18n			    # 语言国际化
│   │   ├── init			    # 数据库缓存初始化
│   │   ├── model			    # 响应体数据封装
│   │   ├── security			# 身份权限认证
│   │   ├── service			    # 业务服务层
│   │   ├── template			# 消息模板
│   │   ├── utils			    # 工具类
│   │   └── index.js			# 入口文件
│   ├── pageckge.json			# 项目依赖
│   └── wrangler.toml			# 项目配置
│
├── mail-vue				    # vue前端项目
│   ├── src
│   │   ├── axios 			    # axios配置
│   │   ├── components			# 自定义组件
│   │   ├── echarts			    # echarts组件导入
│   │   ├── i18n			    # 语言国际化
│   │   ├── init			    # 入站初始化
│   │   ├── layout			    # 主体布局组件
│   │   ├── perm			    # 权限认证
│   │   ├── request			    # api接口
│   │   ├── router			    # 路由配置
│   │   ├── store			    # 全局状态管理
│   │   ├── utils			    # 工具类
│   │   ├── views			    # 页面组件
│   │   ├── app.vue			    # 入口组件
│   │   ├── main.js			    # 入口js
│   │   └── style.css			# 全局css
│   ├── package.json			# 项目依赖
└── └── env.release				# 项目配置
```

## 赞助

<a href="https://doc.skymail.ink/support.html" >
<img width="170px" src="./doc/images/support.png" alt="">
</a>

## 许可证

本项目采用 [MIT](LICENSE) 许可证	


## 交流

[Telegram](https://t.me/cloud_mail_tg)
