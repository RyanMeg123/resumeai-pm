<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your Next.js app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `AIHUBMIX_API_KEY` in `.env.local`
3. Run the app:
   `npm run dev`

## Deploy to Vercel

项目的 `vercel.json` 指定 Next.js 和 300 秒 API 上限，题库 Markdown/JSON 会随服务端函数打包。Vercel 必须绑定 Upstash Redis 的 `KV_REST_API_URL`、`KV_REST_API_TOKEN`，配置 `AIHUBMIX_API_KEY`、`PRACTICE_PASSWORD_HASHES` 与 AI 额度；缺少共享存储时拒绝读写，不回退到临时磁盘。当前存储使用 Free 方案，关闭自动升级与淘汰。预览环境需单独绑定存储或命名空间，不能直接复用生产数据。


## 公司面经资料

[按公司分类的AI产品经理面经题](interview-questions/companies/README.md)：字节87、腾讯14、理想20、富途10、美团15，共146条。首页「大厂面经」可按公司和段落答题，JSON保留来源、轮次与追问关系。草稿保存在本机，提交已答题可查看练习反馈。

### 个人项目账号（本地试用）

首页的「我的项目深挖」进入 `/project`，未登录时进入 `/login`。目前预置账号为 `zhangwenjing`、`xiaohe`、`tianyijia`。文婧账号绑定现有 `zhangwenjing-*` 项目题库，另外两位显示待补充简历；公共题库仍可直接练习。

密码仅以独立盐值的 scrypt 哈希配置在忽略提交的 `.env.local` 中，变量 `PRACTICE_PASSWORD_HASHES` 为账号到 `salt:hash` 的 JSON 映射。修改配置后重启服务。账号归属在 `lib/auth.ts` 的 `ACCOUNTS` 中定义，`lib/user-projects.ts` 同时按文件 ID 前缀和姓名筛选材料。用户可在「我的项目深挖」保存新简历并点击 AI 更新，生成题库自动绑定当前账号；没有生成题库时继续使用该账号已有的静态材料。

项目页面、旧项目链接和项目评分接口均在服务端验证归属。HttpOnly 会话有效期为 7 天，退出后立即撤销；会话和登录尝试限制保存在同一个持久化存储中，服务重启不丢失登录；云端会话自动到期，退出会撤销对应记录。当前简易账号用于本地试用，正式上线前更换测试密码并配置 HTTPS。

项目练习草稿、公司面经草稿、简历练习资料和全刷解锁记录按账号分别存于当前浏览器；不跨设备同步，清理浏览器数据会丢失。项目草稿恢复题目、回答和进度，评分结果需再次提交获取。登录不会将游客的旧资料自动归入个人账号。

本地运行服务后，可用 `PRACTICE_TEST_PASSWORD=测试密码 node --test tests/project-auth.test.mjs` 验证登录、项目归属、旧链接拦截和退出撤销；测试仅请求 `127.0.0.1:3000`，不调用 AI 或生产服务。

### AI 分析与用量控制

所有 AI 调用都经服务端 AIHubMix 网关，Key 只放 `.env.local` 中的 `AIHUBMIX_API_KEY`，浏览器不接触 Key。默认模型为 `gemini-3.1-flash-lite`，可用 `AIHUBMIX_MODEL` 调整。

| 场景 | 触发方式 | 复用方式 |
| --- | --- | --- |
| 简历解析、项目改写、整份简历草稿 | 登录后明确点击分析/生成 | 同账号相同输入与模型直接复用 |
| 模拟面试、简历定向题 | 明确开始或请求下一题 | 相同简历及问答上下文复用 |
| 个人项目题库更新 | `/project` 保存简历，再点击 AI 更新 | 相同简历版本不重复生成，最多5个核心项目、总题量不超过20 |
| 逐题参考答案 | 先查已有参考，缺失时再点击生成 | 通用/公司参考跨账号共用；私人项目不共用 |
| 逐题回答点评 | 先查记录，缺失时明确点击生成；“历史点评”可回看当时回答 | 按账号、题目、回答和对应简历版本复用 |

`/project` 可编辑简历或导入 PDF/DOCX/TXT（5MB、正文2万字以内）。简历打磨的结果页可将已确认项目保存为个人简历，再去更新深挖。保存和查看不调用 AI；切题、刷新、切换项目不自动请求模型。新题库成功且仍对应当前简历后才切换，失败或并发修改不会覆盖旧题库。原始 Markdown 题库保持保留。

本地未配置 Redis 时，AI 成功结果、token 用量、简历及历史生成版本写入忽略提交的 `.practice-data/`；Vercel 上写入私有 Redis，重启及重新部署仍可复用。不要把该目录放到 `public/`、提交 Git 或公开备份。个人记录按已登录账号隔离，公共参考仅使用公共题面。通用评分仍是免费规则评分，AI 逐题点评单独按需触发。

每日额度按 UTC 日历日计数：默认每人20次、全站60次新请求，可通过 `AI_DAILY_USER_LIMIT` / `AI_DAILY_TOTAL_LIMIT` 调整，设为0可暂停新生成。发送上游前预留额度，失败请求也计数（上游可能已计费）；失败后一分钟内不重复发送，不自动重试。并发相同请求合并，已缓存内容不占次数。页面显示自己的当日用量。请求数上限不是金额上限，最终费用以 AIHubMix 账单为准。

云端请求去重、简历并发更新和额度账本使用 Redis 共享锁。写入前原子校验锁的持有者；180 秒租约失效时拒绝旧请求写入，90 秒 AI 请求超时且不自动重试。云存储失败时返回错误，不以空记录或本机临时文件代替。定期备份个人资料和生成记录；免费存储达到限额会拒绝请求，不自动升级收费。


AI 回归测试使用完全隔离的数据与本机假接口，不消耗真实 API：

```sh
node tests/fixtures/ai-provider.mjs
# 另一个终端，PRACTICE_DATA_DIR 每轮使用一个新的可丢弃目录：
PRACTICE_DATA_DIR=/tmp/resumeai-ai-test NEXT_DIST_DIR=.next-ai-test AI_TEST_ENDPOINT=http://127.0.0.1:39318/v1/chat/completions AIHUBMIX_MODEL=fixture-ai AI_DAILY_USER_LIMIT=16 AI_DAILY_TOTAL_LIMIT=30 npm run dev -- --hostname 127.0.0.1 --port 3001
# 服务启动后：
PRACTICE_TEST_PASSWORD=本地测试密码 node --test tests/ai.integration.test.mjs
```

假接口仅监听本机，不转发请求；`AI_TEST_ENDPOINT` 仅在非生产环境接受 loopback 地址。测试覆盖权限、公共缓存复用、私人点评隔离、历史回答、并发合并、简历版本竞争、失败冷却、个人及全站额度。测试服务停止后保留主开发服务运行。

共享存储验证：设置隔离的 `PRACTICE_STORAGE_NAMESPACE=test:唯一标识` 和测试 Redis 凭据，运行 `node tests/cloud-store.test.mjs`，验证跨进程并发、过期锁拒写、会话过期/撤销和缺少生产配置时拒绝读写。测试不会调用 AI。
