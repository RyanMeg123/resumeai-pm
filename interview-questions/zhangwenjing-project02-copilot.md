<!-- @format -->

# 张文婧 · 项目面试题 · AI 运营内容生成与多语言本地化 Copilot

> 说明：本题库基于「AI 运营内容生成与多语言本地化 Copilot」项目文档定制，含文本通道（RAG + Agent）和图像通道（ComfyUI + 自训 LoRA）。其中 **§5 ComfyUI v1→v2→v3 迭代** 是重中之重，每题深挖"遇到什么问题→怎么诊断→怎么解决"，体现真实动手经验。共 70 题。

---

## 1. 项目背景与动机

### Q1. 这个 Copilot 项目的出发点是什么？和项目01（流失预警）是什么关系？

**面试官意图**：考察项目定位和全局思考。

**参考答案**：

> 两个项目是"生产者-消费者"关系。项目01 的归因结论会产出"需要什么样的挽回活动"，比如"工会解散类用户需要工会推荐礼包"。Copilot 消费这个需求，生成具体的活动配置 JSON + 9 语言挽回邮件 + 兑换码。反过来，Copilot 生成的活动数据进入 `activities` 表后，会成为项目01 下一轮"可选挽回策略"的供给。
>
> Copilot 的直接出发点是运营的日常痛点：一次跨服春节活动从运营草案到 9 语言上线要 **5 天**，其中 3 天卡在翻译校对。运营 50% 时间消耗在手工拼 ActivityPack/ActivityPass/ActivityRank* 等 JSON 配置 + 等本地化。策划想试一套"春节汉服"换装方案也要排美术等 2-3 天。
>
> 所以 Copilot 做两件事：文本通道解决"写什么"（活动配置 + 邮件 + 兑换码），图像通道解决"画什么"（Banner + 妃子换装 + 召回头图）。双通道共享一套意图理解层和术语词典。

**可能追问**：如果只能做一个项目，你选流失预警还是 Copilot？

---

### Q2. "日文术语漂移引发社区负面事件"能详细讲讲吗？

**面试官意图**：用真实事件验证项目动机的真实性。

**参考答案**：

> 那次是跨服春节活动，运营写了中文邮件然后让本地化翻译成 9 语言。日文版本里"结义"这个系统名词出现了三种翻译："義兄弟の誓い"、"兄弟の約束"、还有一次直接写了"結義"（中文原文未翻译）。玩家截图发了社区，吐槽"连术语都搞不统一，运营到底有没有过审"。
>
> 这件事的根因不是翻译水平问题，而是**没有术语库强约束**——每次翻译都是 LLM 或人工自由翻译，"结义"在 `translate` 表里有标准翻译 `義兄弟の誓い`（key: `system.brotherhood`），但翻译流程里没有强制引用。
>
> 这直接催生了我设计的"术语强制替换"机制：LLM 只负责识别"这里是术语"，输出占位符 `{{term.system.brotherhood}}`，具体翻译由 translate 表决定。这样术语准确率能做到 100%。

**可能追问**：这个事件造成了多大的影响？有没有量化损失？

---

### Q3. 为什么要做双通道（文本+图像）？不是两个独立项目吗？

**面试官意图**：考察产品架构思维。

**参考答案**：

> 合在一起是因为它们共享三个核心模块：
>
> 1. **意图理解层（F1）**：运营说"做一个春节充值返利活动"，F1 解析出 `activity_type=PAYMENT_REBATE, theme=春节`。文本通道用这个生成活动 JSON，图像通道用这个决定"春节主题 → 红色汉服风格的 Banner 和妃子换装"。
> 2. **术语词典（F6）**：Banner 上的文字本地化和邮件正文本地化用同一份 translate 表词典。
> 3. **审核与发布流程**：文本和图像的审核、入库、回滚走同一套 UI 和审计日志。
>
> 如果拆成两个项目，运营每次做活动要打开两个工具、输入两遍需求、审核两次。合在一起就是"一句话出一场活动"——文字配置 + 9 语言邮件 + Banner + 妃子换装预览一次性全出。
>
> 但它们的技术栈确实不同：文本通道是 RAG + Agent + JSON Schema，图像通道是 ComfyUI + SDXL + LoRA。所以我在 PRD 里把它们标为不同的 Feature 编号（F1-F16 文本通道，F17-F19 图像通道），开发上可以并行，但产品上是一个整体。

**可能追问**：图像通道是 v1.1 才纳入 MVP 的，最初为什么排除了？

---

### Q4. 活动上线周期从 5 天压到 0.5 天，这个目标怎么估算的？

**面试官意图**：考察目标设定的合理性。

**参考答案**：

> 我把 5 天拆成了各环节耗时：
>
> | 环节 | 现状 | Copilot 后 |
> |------|------|-----------|
> | 运营写需求 + 拼 JSON | 2-4 小时 | 5 分钟（自然语言输入） |
> | JSON 校验 + 修改 | 1-2 小时 | 0（Schema 自动校验） |
> | 翻译 9 语言 | 2-3 天 | 2 小时（LLM + 术语替换） |
> | 翻译校对 | 0.5-1 天 | 30 分钟（差异视图审核） |
> | QA 验证 | 0.5 天 | 15 分钟（Dry-run 沙盒自动检查） |
> | **总计** | **~5 天** | **~4 小时 ≈ 0.5 天** |
>
> 最大的时间杀手是翻译（2-3 天），Copilot 用 LLM + 术语强制替换可以压到 2 小时。校对从"逐条人工对照"变成"差异视图看偏差"，从半天压到 30 分钟。
>
> 0.5 天是 MVP 保守目标，理想态是 30 分钟——全自动生成，人工只做最终审核点一下 approve。

**可能追问**：如果翻译质量不够，运营还是要花很多时间改，0.5天能保证吗？

---

### Q5. 12 份访谈纪要怎么产出的？

**面试官意图**：考察调研方法论的真实性。

**参考答案**：

> 我调研了 4 类角色，每类做了 3 轮访谈（初次调研 + 方案展示 + 原型验证），4×3 = 12 份纪要：
>
> - **运营策划（3 人）× 3 轮**：第一轮聊痛点（"你一天花多少时间拼 JSON"），第二轮展示 RAG 方案原型让他们评价，第三轮让他们实际试用 Copilot 生成的 JSON 看是否可用。
> - **本地化（2 人）× 3 轮**：第一轮聊翻译流程和术语漂移案例，第二轮展示术语强制替换机制让他们评估，第三轮对比人工翻译和 Copilot 翻译质量。
> - **兑换码运营（1 人）× 3 轮**：聊 16 个字段的填写痛点，展示批量生成方案。
> - **QA（2 人）× 3 轮**：聊上线前验证的痛点，展示 Dry-run 沙盒方案。
>
> 每份纪要的结构是：受访者角色 / 日期 / 主要痛点 TOP-3 / 关键引述 / Action Items。12 份纪要最终汇总成"痛点 TOP-10 矩阵"，直接指导了 F1-F19 的优先级排序。

**可能追问**：痛点矩阵是怎么做的？怎么确定优先级？

---

### Q6. MVP 为什么选充值返利+排行榜+兑换码？

**面试官意图**：考察 MVP 范围选择的依据。

**参考答案**：

> 三个标准：**高频 × 高痛 × 可标准化**。
>
> - **充值返利**：每周 1-2 次，运营最高频的活动类型，JSON 结构相对固定（ActivityPack + 奖励阶梯），RAG 命中率高。
> - **排行榜**：每周 1 次，跨服排行榜配置最容易出兼容性问题（`cross_servers` 字段、`XServerRankType` 模块），Dry-run 沙盒价值最大。
> - **兑换码批次**：每天都有，16 个字段手工填是"最苦的活"——运营都恨不得有人替他们干。这是"先做苦活赢信任"的策略。
>
> 工会活动没选是因为它涉及跨表联动更复杂（`guild_config` + `guild_rank` + `players.guild_info`），MVP 阶段不值得冒险。这三类占运营日常 70%，先打通再扩展。

**可能追问**：70% 这个数字怎么来的？

---

### Q7. 游戏运营 Copilot 有没有直接竞品？

**面试官意图**：考察竞品分析深度。

**参考答案**：

> 没有直接公开的"游戏运营 AI Copilot"产品，但有三类参考：
>
> 1. **通用 AI Copilot**：GitHub Copilot（代码补全）、Notion AI（文档生成）。我借鉴的是"在用户熟悉的界面里嵌入 AI"的理念——运营不离开自己的后台，Copilot 就在他们日常用的 Game Panel 里。
> 2. **游戏行业公开实践**：网易的"运营自动化"公开分享、Supercell 的 GDC 分享。但他们的方案都是规则引擎，没用 LLM。
> 3. **JSON 生成类产品**：Retool AI、Zapier AI Actions。但它们不懂游戏业务——不知道 `spec_version_hash` 意味着什么、不知道 `ActivityRankT` 和 `ActivityRankA` 的区别。
>
> 这也是为什么 RAG 是核心——12608 条真实的版本化配置就是"游戏业务知识"，通用 LLM 不可能知道。

**可能追问**：如果有一天通用 AI 足够聪明不需要 RAG 了，你的方案还有价值吗？

---

## 2. 文本通道 · RAG 与 Agent

### Q8. 12608 条配置做 RAG，切片策略怎么设计的？

**面试官意图**：考察 RAG 工程化能力。

**参考答案**：

> 按 `(name, spec_version_hash)` 一条一份，不做进一步切片。原因：
>
> 1. **每条就是一个独立的配置模块**：`configurations` 表的设计是"一个 name + 一个版本 = 一份完整配置"，天然就是 RAG 的"文档"粒度。切更细会破坏配置的完整性——运营需要看到一个完整的 ActivityPack JSON，不是片段。
>
> 2. **长短差异大**：有些配置几十字节（简单 flag），有些几十 KB（完整活动配置）。我不做统一 chunk_size 切片，而是对嵌入内容做摘要：`模块名 + 关键字段摘要 + 奖励结构签名`。这样短文档不浪费，长文档不超限。
>
> 3. **元数据携带版本信息**：每条记录的元数据包含 `{name, spec_version_hash, activity_type_guess, has_reward, reward_types}`，检索时先做硬过滤再做语义召回。
>
> 分层索引四层：Layer 1（12608 条配置）、Layer 2（142 条邮件）、Layer 3（37 条兑换码）、Layer 4（术语词典，非向量 KV 查询）。

**可能追问**：嵌入模型选的什么？为什么用 bge-large-zh-v1.5？

---

### Q9. RAG 混合检索三步具体怎么做的？

**面试官意图**：考察 RAG 检索策略的工程细节。

**参考答案**：

> **Step 1 · 元数据硬过滤**：基于意图 JSON 的 `activity_type` 和 `target_servers` 做确定性过滤。比如运营要做 PAYMENT_REBATE 活动给 server 100/101，先把候选集从 12608 条缩小到只含 `activity_type=PAYMENT_REBATE` 且版本兼容目标服的几百条。这一步不用向量检索，纯 SQL WHERE。
>
> **Step 2 · 语义召回**：把意图 JSON 转成自然语言描述（"春节主题的充值返利活动，7 天，两档奖励"），在 Step 1 的候选集里做 embedding 相似度搜索，取 TOP-20。
>
> **Step 3 · 重排**：用 LLM 做二次筛选——把 20 条候选和意图一起喂给 LLM，让它选出"最适合作为参考模板"的 TOP-5。重排比 Cross-Encoder 更贵但更准，因为 LLM 能理解"这个活动的奖励结构和用户要求的阶梯是否匹配"这种语义判断。
>
> 最终返回 5 条相似案例给 Agent 的 `generate_activity_config` 工具做 few-shot。

**可能追问**：Step 3 用 LLM 重排会不会太慢？成本呢？

---

### Q10. 为什么不把 12608 条全塞进 Context？

**面试官意图**：经典 RAG vs long-context 之争。

**参考答案**：

> 三个原因：
>
> 1. **Token 量爆炸**：单条配置平均 500-2000 token，12608 条 = 6M-25M token。即使用 128K context 的模型也塞不下。
> 2. **注意力涣散**：就算塞得下，LLM 在长 context 里"大海捞针"的效果远不如精准的 TOP-5 few-shot。运营只关心和当前需求相似的 3-5 条案例，其余是噪声。
> 3. **成本差 100 倍**：RAG 把有效 context 压到 5-10K token，单次调用 $0.01-$0.05。全塞进去要 $5-$25 一次。运营每天调用 10-20 次，差距巨大。
>
> RAG 的价值不是"因为塞不下所以才用"，而是"检索本身就是一种信息压缩"——12608 条里只有 5 条跟当前需求相关，RAG 帮我找到这 5 条。

**可能追问**：如果模型的 context window 无限大且免费呢？

---

### Q11. 5 个 Agent 工具的调用顺序是固定的还是自主决策？

**面试官意图**：考察 Workflow vs Agent 的理解。

**参考答案**：

> **MVP 是固定顺序（Workflow），不是 Agent 自主决策**。调用链：
>
> ```
> 意图理解 → RAG 检索 → generate_activity_config → generate_mail_draft
>           → localize_all_languages → generate_exchange_code_batch → design_reward_bundle
> ```
>
> 有依赖关系：邮件需要活动配置才能引用附件；本地化需要邮件草稿；兑换码需要知道活动 ID。
>
> 原因和项目01一样：**可预测性 > 灵活性**。运营配置是要上线的，Agent 自主决策可能跳过 JSON Schema 校验或者漏了本地化——这个风险在 MVP 阶段不能接受。
>
> PRD 里 F15（Copilot Chat 多轮对话）放在 P1，未来会引入 Agent 自主决策：比如运营说"奖励再加一档"，Agent 自己判断需要调用 `design_reward_bundle` 再跑一次，而不是重走全流程。

**可能追问**：固定顺序的情况下还叫 Agent 吗？

---

### Q12. JSON Schema 校验不通过怎么办？重试 3 次还是失败呢？

**面试官意图**：考察降级策略。

**参考答案**：

> 三层保障：
>
> 1. **Prompt 层**：注入完整 JSON Schema + 3 个 few-shot 示例 + `allowed_items` 白名单。
> 2. **重试层**：生成后用 Python `jsonschema` 库校验。不通过则把 error 信息塞回 Prompt 让 LLM 自改，最多重试 3 次。第二次重试时还会追加"这是你上次犯的错，不要再犯"。
> 3. **降级层**：3 次都失败 → 返回"AI 生成半成品 + 错误清单"给运营。半成品是"能解析但有字段缺失/类型错误的 JSON"，错误清单标明哪些字段需要人工补全。
>
> 实测 JSON Schema 一次通过率目标 ≥ 90%，重试后通过率 ≥ 98%。剩下 2% 降级给人工——比运营从零拼 JSON 还是快很多。
>
> 关键设计：**重试不是简单重跑，而是把 error 作为 context 喂回去**。LLM 看到"你生成的 `start_time` 是 string 但 schema 要求 int64"，第二次大概率能改对。

**可能追问**：如果 LLM 每次都错同一个字段呢？是 Prompt 的问题还是 Schema 的问题？

---

### Q13. 术语强制替换机制能完整讲一遍吗？这是你最得意的设计。

**面试官意图**：核心亮点深度追问。

**参考答案**：

> 四步流水线：
>
> **Step 1 · 构建术语词典**：从 `translate` 表 59016 行中，只取 `id` 前缀匹配白名单（`system.*`、`item.name.*`、`skill.*`、`npc.name.*`）的行作为术语，约 8000-12000 条。构建映射 `key → {cn, tw, jp, kr, en, de, fr, ru}`。
>
> **Step 2 · Prompt 注入占位符规则**：LLM Prompt 里注入："凡是游戏术语，输出 `{{term.KEY}}` 占位符，不要翻译。只翻译非术语的自然语言部分。"同时给 few-shot 示例。
>
> **Step 3 · 后处理替换**：用 Python 正则 `re.sub(r"\{\{term\.([^}]+)\}\}", replacer, text)` 把占位符替换成目标语言的值。如果词典里没有 → 标记 `[TERM_MISSING:xxx]` 让人工介入。
>
> **Step 4 · 术语扫描器**：反向扫描最终文本，看有没有中文术语"漏网"（LLM 没识别出来直接翻译了）。用命名实体识别做模糊匹配，命中则标红让人工确认。
>
> **核心思想**：不靠 LLM 听话，靠后处理强制替换。LLM 只负责"识别这里是术语"（识别准确率 95%+），具体翻译由词典决定（100% 准确）。这比直接让 LLM 翻译术语靠谱 100 倍。

**可能追问**：如果 LLM 连"识别术语位置"都做不好怎么办？

---

### Q14. spec_version_hash 版本兼容校验是什么？

**面试官意图**：考察对游戏配置版本管理的理解。

**参考答案**：

> `configurations` 表按 `(name, spec_version_hash)` 唯一，12608 条 = 54 个版本 × 多个模块。不同版本的 ActivityPack 字段可能不同——v1.28-beta11 可能有 `gift_type` 字段但 v1.27 没有。
>
> 如果 Copilot 基于 v1.28 的案例生成了一个 JSON，但目标服跑的是 v1.27，上线后就会报字段不兼容。**这是运营最容易忽略、也是历史上真出过事故的地方。**
>
> 我的校验流程：
> 1. 查 `server_list` 拿目标服当前的 `spec_version_hash`。
> 2. 从 `configurations` 中筛出该版本对应模块的 Schema（用 genson 库反推）。
> 3. 生成的 JSON 做 Schema 校验——不合规就带着 error 让 LLM 重试。
> 4. RAG 检索阶段也用 `spec_version_hash` 做元数据过滤，只返回兼容版本的案例。
>
> 这是双层约束：**检索阶段过滤 + 生成阶段校验**，两层都用版本信息。

**可能追问**：54 个版本都需要推导 Schema 吗？工作量多大？

---

### Q15. Dry-run 沙盒能拦住多少线上事故？

**面试官意图**：考察沙盒的有效性。

**参考答案**：

> 我从 `operation_log` 和内部复盘文档中回放了 10 次历史线上事故，评估 Dry-run 能拦住几次：
>
> | 历史事故 | 能否拦住 |
> |---------|---------|
> | activity_id 与现网冲突 | ✅（SQL 检查 end_time > now） |
> | server_range 覆盖了已停服的服务器 | ✅ |
> | 奖励 item_id 已下架 | ✅ |
> | 邮件过期时间早于开始时间 | ✅ |
> | 跨服配置引用了错误服组 | ✅ |
> | 翻译缺失导致显示 key | ❌（这是内容问题不是配置问题） |
>
> **目标拦截率 ≥ 85%**，主要覆盖"配置级兼容性"事故。翻译质量问题由术语扫描器和人工审核兜底，不是 Dry-run 的职责。
>
> 沙盒复用了我恢复 Refantasia 数据时搭建的 `mysql84` Docker，每次 Dry-run 后重置到干净 snapshot，并发限制 3 个任务。

**可能追问**：沙盒和真实线上环境的数据会不会不同步？

---

### Q16. 差异视图的设计动机是什么？

**面试官意图**：考察产品设计思维。

**参考答案**：

> 设计动机和项目01的"三层透明化"一脉相承：**AI 产品的核心 UX 不是"输出多准确"，而是"用户能不能验证输出"。**
>
> 差异视图的设计是：左侧是 RAG 命中的最相似历史模板，右侧是 Copilot 生成结果，所有不同字段高亮。运营看到的不是"黑盒结果"，而是"相对历史模板的增量改动"。
>
> 好处：
> 1. **审核速度快**：运营不需要逐字段检查整个 JSON，只需要看"红色标记的改动"是否合理。
> 2. **有 anchor**：历史模板是运营自己上过线的，是他们信任的东西。Copilot 的输出"站在历史模板的肩膀上"，信任成本更低。
> 3. **反哺 Prompt 迭代**：运营的每次修改都记录在审计日志里。如果某个字段运营总是要改，说明 Prompt 在这个字段上不够好，需要迭代。

**可能追问**：如果运营总是直接 approve 不看差异，这个设计就失去意义了怎么办？

---

### Q17. LLM 服务中断时，降级方案是什么？

**面试官意图**：考察系统弹性设计。

**参考答案**：

> 五种降级场景全覆盖：
>
> | 场景 | 降级方案 |
> |------|---------|
> | LLM 服务中断 | 切换为"模板参数化填充"：基于 RAG 命中的历史模板 + 意图 JSON 做字符串替换 |
> | JSON Schema 重试 3 次仍失败 | 返回半成品 + 错误清单给运营人工补全 |
> | 术语词典缺失 | 保留中文原文 + `[TERM_MISSING]` 标记 |
> | Dry-run 兼容性失败 | 不允许一键发布，弹错误详情 |
> | LLM 日预算耗尽 | 熔断，剩余请求走模板降级 |
>
> 降级后质量能不能接受？**能**，但运营需要多花时间手工补全。降级的本质是"AI 做到 80%，人做剩下 20%"——比"AI 完全不可用，人做 100%"好得多。而且降级触发率目标 ≤ 10%，大多数时候 LLM 是可用的。

**可能追问**：日预算 $20，平均每次调用多少钱？一天能跑多少次？

---

## 3. 指标体系与评测

### Q18. 北极星指标为什么是 TTP 而不是 ROI？

**面试官意图**：考察指标选择的商业逻辑。

**参考答案**：

> TTP（Time-to-Publish，活动上线周期）比 ROI 更适合 Copilot 的场景，三个原因：
>
> 1. **因果更直接**：Copilot 的直接产出是"更快上线"，TTP 直接衡量这个产出。而 ROI 受活动质量、玩家偏好、竞品活动等太多因素影响，Copilot 的贡献很难隔离。
> 2. **可测量**：TTP 精确到小时，每次活动都有记录。ROI 需要等 30 天回收期。
> 3. **和痛点直接对齐**：运营最痛的是"5 天才能上线一个活动"，TTP 直接衡量痛点缓解程度。
>
> 但我也有辅助的"业务回流指标"：上线后 7 日的玩家参与率、邮件打开率——如果 TTP 快了但活动质量差了，这些指标会报警。

**可能追问**：如果 TTP 从 5 天压到了 0.5 天，但活动参与率下降了，你怎么看？

---

### Q19. JSON Schema 一次通过率 ≥ 90% 合理吗？

**面试官意图**：考察目标设定的可行性。

**参考答案**：

> 合理，因为三层保障叠加后这个目标不难达到：
>
> 1. **Prompt 里注入完整 Schema + few-shot**：LLM 有"抄作业"的参考，大部分字段能对。
> 2. **JSON mode 强制结构化输出**：调用时启用 `response_format: { type: 'json_object' }`，保证至少输出合法 JSON（语法层面 100%）。
> 3. **字段类型和枚举值**是 Schema 校验的主要检查项，LLM 在 few-shot 下这些基本不会错。
>
> 不通过的 10% 通常是：新出现的 `item_id` 不在白名单、`start_time` 格式微妙差异、嵌套数组里的可选字段遗漏。这些靠重试带 error feedback 能修。
>
> 验证方法：用 200 条真实历史配置做回归测试——用 LLM 反推运营意图，再让 Copilot 重新生成，和原始配置做 diff。目标是"完全一致 + 语义等价 ≥ 90%"。

**可能追问**：200 条回归测试集怎么挑的？分布合理吗？

---

### Q20. 术语替换率 ≥ 95% 怎么自动评测？

**面试官意图**：考察评测工程化。

**参考答案**：

> 自动评测脚本逻辑：
>
> 1. 拿到 Copilot 生成的最终文本（已替换术语后）。
> 2. 遍历术语词典，对每个术语检查：原始中文出现在输入里的 → 目标语言翻译是否出现在输出里。
> 3. 三种结果：correct（正确替换）、incorrect（出现了错误翻译）、missing（标记了 `[TERM_MISSING]`）。
> 4. 替换率 = correct / (correct + incorrect)。missing 单独统计不算在替换率里（因为 missing 是预期的降级行为）。
>
> **误报处理**：自动评测的假阳性主要来自"同一个中文词在不同上下文里可能不是术语"（比如"宫殿"可能是游戏术语也可能是通用词）。解决方案：只检查 `id` 在术语词典白名单里的词，不做泛匹配。
>
> 每周本地化同学还会抽检 50 条做人工复核，修正自动评测的假阳性和假阴性。

**可能追问**：如果 LLM 没识别出术语位置直接翻译了，术语扫描器能发现吗？

---

### Q21. 回归测试集 200 条怎么构造的？

**面试官意图**：考察评测方法论。

**参考答案**：

> 从三个数据源按模块分层抽样：
>
> | 类别 | 样本数 | 来源 |
> |------|--------|------|
> | ActivityPack 配置 | 50 | configurations |
> | ActivityPass 配置 | 30 | configurations |
> | ActivityRank* 配置 | 40 | configurations |
> | 历史邮件（3 语言）| 60 | mail_contents |
> | 兑换码批次 | 20 | exchange_code |
>
> "用 LLM 反推原始运营意图"这步的靠谱性：**这是一个巧妙的 trick**。我不是让 LLM 凭空猜，而是给它完整的 JSON 配置，让它"从结果反推需求"——比如看到 `payment_usd: 6, rewards: [{type: gem, amount: 600}]` 就反推"充值满 $6 送 600 钻"。这比从零生成容易得多，准确率很高。
>
> 评测标准三档：完全一致（字段级匹配）、语义等价（字段不同但效果相同，比如 `start_time` 差几秒）、结构偏差（字段缺失/多余）。目标：前两者之和 ≥ 90%。

**可能追问**：如果反推出的意图就是错的，整个评测链路就不可信了吧？

---

### Q22. A/B 测试是"运营任务"粒度怎么做？

**面试官意图**：考察实验设计的可行性。

**参考答案**：

> 运营任务粒度的意思是：不是分玩家，而是分活动任务。50% 的活动任务用手工方式上线（A 组），50% 用 Copilot（B 组）。
>
> **分流方式**：按时间交替——周一/三/五的活动走 Copilot，周二/四走手工。或者按活动类型：充值返利走 Copilot，排行榜走手工（控制类型变量）。
>
> **观察指标**：
> - TTP（时长）：Copilot 组预期显著缩短。
> - 上线后 7 日错误率：Copilot 组不能比手工组高。
> - 玩家参与率/邮件打开率：验证"快不等于差"。
>
> **样本量挑战**：运营每周做 5-8 个活动，4 周 = 20-32 个样本。统计显著性不够，所以我把 A/B 定位为"方向性验证"而非"严格统计检验"，结合盲评和运营反馈做综合判断。

**可能追问**：样本量这么小，怎么排除混杂变量？

---

### Q23. 灰度节奏五阶段的放量逻辑是什么？

**面试官意图**：考察上线节奏感。

**参考答案**：

> | 阶段 | 持续 | 范围 | 审核要求 | 升级条件 |
> |------|------|------|---------|---------|
> | 内测 | 2 周 | PM + 1 运营 + 1 本地化 | 每条双审 | 一次通过率 ≥ 70% |
> | 灰度 A | 2 周 | 全部运营 + 本地化 | 每条双审 | 一次通过率 ≥ 80%、修改率 ≤ 30% |
> | 灰度 B | 2 周 | 全部运营 | 活动单审 + 邮件双审 | 一次通过率 ≥ 85%、拒绝率 ≤ 5% |
> | 全量 | 长期 | 全部 | 单审 + 抽检 | 主动使用率 ≥ 90% |
> | 半自动 | 6 月后 | 低风险场景（兑换码） | 仅事后抽检 | 连续 3 月零事故 |
>
> 关键设计：**审核要求逐步放开**。内测阶段"双审"是成本最高的，但也是建立信任的关键——本地化同学亲眼看到 Copilot 的翻译质量，才愿意在灰度 B 阶段放开为单审。兑换码是最先进入半自动的，因为它最标准化、风险最低——这也是 MVP 里"先做苦活赢信任"策略的延续。

**可能追问**：如果灰度阶段出了一次严重事故，你怎么决策？

---

## 4. ComfyUI 图像通道 · 架构与选型

### Q24. 为什么选 ComfyUI 而不是 Midjourney / DALL·E？

**面试官意图**：考察技术选型判断力。

**参考答案**：

> 三个硬约束排除了 MJ/DALL·E：
>
> 1. **画风锁定**：Refantasia 是日系 2.5D + 古风画风。MJ/DALL·E 只能靠 prompt 描述画风，无法挂 LoRA 精确锁定。我自训了 `refantasia_style_v1` LoRA，出图一秒看出"这是我们游戏的"。
> 2. **角色身份锁定**：妃子 W1 的银发紫眸必须保持。MJ/DALL·E 做不到 IP-Adapter FaceID 级别的锁脸，只能靠 prompt 描述"silver hair purple eyes"，稳定性差。
> 3. **工作流可编排可审计**：ComfyUI 的节点图就是可视化的生产流水线。每个节点参数都有记录，出了问题能精确定位"是 IPAdapter weight 太低还是 ControlNet 太强"。MJ 是黑盒。
>
> 成本也是考量：MJ 单图 $0.04+，我们每月 30+ 活动 × 多张候选 = $10+。ComfyUI + OneThingAI A100 按分钟计费 ¥3-6/次，规模越大成本优势越大。

**可能追问**：ComfyUI 的学习曲线高，运营不会用怎么办？

---

### Q25. 图像通道和文本通道怎么联动？

**面试官意图**：考察系统级设计。

**参考答案**：

> 共享三个模块 + 一个数据流闭环：
>
> 1. **意图理解（F1）**：运营说"给春节充值返利活动出一套视觉素材"，F1 解析出 theme=春节，文本通道用它生成活动 JSON，图像通道用它决定换装风格（红色汉服）。
> 2. **术语词典（F6）**：Banner 上的文字（"限时充值返利"）从 translate 表取多语言翻译。
> 3. **审核与发布**：图片入 CDN 后绑定到 `activity.banner_url` 字段——这个字段正好是文本通道生成的活动配置 JSON 里的一个值。
>
> **数据流闭环**：文本通道生成活动配置 → 图像通道生成配套 Banner → Banner URL 回写到活动配置 → 一起进入 Dry-run 沙盒 → 一起审核 → 一起发布。运营不需要手动在两个地方关联。

**可能追问**：如果图像生成失败了，文本通道的活动配置还能发布吗？

---

### Q26. 三条链路为什么 B 先做？

**面试官意图**：考察优先级排序。

**参考答案**：

> 链路 A（Banner 本地化）是最高 ROI 的，但技术依赖多（PaddleOCR + LaMa Inpaint + 文字渲染 + 字体匹配），MVP 阶段成熟度不够。链路 C（召回头图）依赖项目01 的归因输出，但项目01 还没上线。
>
> **链路 B（妃子换装）先做的原因**：
> 1. **技术栈自包含**：只需要 SDXL + IP-Adapter + ControlNet + LoRA，不依赖 OCR 或外部系统。
> 2. **演示效果最震撼**："银发紫眸的妃子换上春节汉服"——面试时一张图就能说清"AI 做了什么"。
> 3. **验证核心技术**：IP-Adapter FaceID 锁脸 + 自训 LoRA 锁画风是三条链路共享的技术底座。B 验证通过了，A 和 C 就能复用。
> 4. **策划有真实需求**：策划每次想试新换装方案都要排美术等 2-3 天，这个痛点是最直接的。

**可能追问**：链路 A 什么时候做？估计多久能跑通？

---

### Q27. 749 张游戏资产怎么从 APK 解包的？

**面试官意图**：考察数据基础建设的动手能力。

**参考答案**：

> 5 步 Python pipeline，脚本在 `~/ceshi-mvp/rf_assets_workdir/`：
>
> 1. **`01_discover.py`**：扫描 APK 里的 Unity AssetBundles（1159 个 sprite 对象），生成 `discover_catalog.csv`。注意 Unity Addressables 开了 name stripping，`bin/Data/` 下的对象名都被剥离了，但 `sprite/avatar/` 下的 `.dat` 文件名本身就是 Addressable key。
>
> 2. **`02_extract.py`**：用 UnityPy 加载每个 `.dat`，取面积最大的 Texture2D 存 PNG。产出 749 张 2048×2048（妃子 195 + 武将宽 231 + 武将半 238 + NPC 55 + 玩家 30）。
>
> 3. **`03_align_db.py`**：从 Docker MySQL 读 `configurations.SkinWife` 18 条记录，和本地 PNG 做 key 对齐。`norm_key("W1SkinFi")` → `"w1_half_skinfi"`，18/18 = **100% 对齐**。输出 `asset_key_file.sql`。
>
> 4. **`04_trim_alpha.py`**：Pillow `getbbox()` 按 alpha 通道裁掉 texture atlas 的黑红棋盘 padding，1.05GB → 461MB。
>
> 5. **`05_sample_lora_dataset.py`**：平衡采样 130 张做 LoRA 训练集（妃子 35 char × base+skin / 武将 30 / NPC 20 / 玩家 10），短边 ≥ 640px（SDXL bucket 最低要求），`random.seed(42)` 可复现。

**可能追问**：Unity name stripping 那个坑你是怎么发现的？

---

### Q28. SkinWife 18 条 100% 对齐意味着什么？

**面试官意图**：考察数据工程的严谨性。

**参考答案**：

> 意味着**DB 里的妃子配置和本地 PNG 资产是完全对应的**——每个 `asset_key` 都能找到对应的图片。这是整条链路的基础：
>
> 1. Web UI 选妃子时，从 `asset_key_file` 表查列表，每条有 `remote_url` 指向七牛 CDN。
> 2. 用户选了某个妃子，API 从 `asset_key_file` 查 URL → fetch CDN → 上传 ComfyUI input/。
> 3. ComfyUI 工作流 LoadImage 节点加载这张图做 IP-Adapter FaceID 锁脸。
>
> 如果对齐率不是 100%，就会出现"用户选了一个妃子但系统找不到图"的情况。所以 `03_align_db.py` 是整条 pipeline 的质量关卡。

**可能追问**：剩下的 195-18=177 张妃子图没有 DB 配置对齐，还能用吗？

---

### Q29. 为什么选 SDXL 而不是 SD1.5 或 Flux？

**面试官意图**：考察模型选型判断。

**参考答案**：

> 1. **vs SD1.5**：SDXL 的画质和一致性远超 SD1.5，特别是面部细节和手部——我们的妃子立绘是高精度 2048×2048，SD1.5 的原生分辨率 512×512 不够用。而且 IP-Adapter FaceID Plus V2 的 SDXL 版本锁脸效果更好。
>
> 2. **vs Flux**：Flux 出图质量确实更好，但 2026 年 4 月时 ComfyUI 的 Flux 生态还不够成熟——IP-Adapter、ControlNet、FaceDetailer 这些关键节点的 Flux 兼容性不稳定。SDXL 的生态最成熟，所有我需要的节点（IPAdapter_plus、controlnet_aux、FaceDetailer）都有稳定支持。
>
> 3. **LoRA 训练成熟度**：kohya_ss 对 SDXL LoRA 训练的支持最完善，文档和社区经验最多。Flux LoRA 训练当时还在早期阶段。
>
> 总结：不是选"最强的模型"，而是选"生态最完善、最能稳定跑通全链路的模型"。

**可能追问**：如果 Flux 的 ComfyUI 生态成熟了，你会迁移吗？成本多大？

---

### Q30. IP-Adapter FaceID weight 0.85 怎么确定的？

**面试官意图**：考察参数调优的方法论。

**参考答案**：

> 0.85 是在"脸像"和"换装自由度"之间的甜点：
>
> - **太高（>0.9）**：脸 100% 像原图，但服装也被锁住了——换装效果出不来。IP-Adapter 不只锁脸，还会锁住整体风格，weight 太高连衣服都变不了。
> - **太低（<0.7）**：服装变化自由了，但脸会飘——银发可能变成金发，紫眸可能变成蓝眸。角色辨识度不够。
> - **0.85**：脸部特征（银发紫眸+面部轮廓）保持度 ≥ 85%，但衣服、背景、配饰有足够变化空间。
>
> 调参方法：手工跑 10 组对照实验（0.7/0.75/0.8/0.85/0.9/0.95），让策划盲评"哪组最像原角色但换装效果最好"。0.85 获得最高综合评分。这个值从 v1 就锁定了，v2/v3 没改。

**可能追问**：`weight_faceidv2=1.0` 和 `weight=0.85` 有什么区别？

---

## 5. ComfyUI · v1→v2→v3 迭代全过程（重中之重）

### Q31. v1 的 14 个节点分别是什么？

**面试官意图**：验证你真的手搭过最小可演示版。

**参考答案**：

> v1（2026-04-07，文件 `linkB_consort_outfit.json`）是最小链路：
>
> | # | 节点 | 作用 |
> |---|------|------|
> | 1 | CheckpointLoaderSimple | 加载 `albedobaseXL_v21.safetensors` |
> | 3 | LoraLoader | 加载 `ip-adapter-faceid-plusv2_sdxl_lora` @ str 0.6 |
> | 4 | LoadImage | 加载 `w1_half.png`（妃子原图） |
> | 5 | IPAdapterUnifiedLoaderFaceID | preset: FACEID PLUS V2, provider=CPU |
> | 6 | IPAdapterFaceID | weight 0.85 锁脸 |
> | 7 | OpenposePreprocessor | 提取姿势骨架，resolution 1024 |
> | 8 | ControlNetLoader | 加载 OpenPoseXL2.safetensors |
> | 9 | ControlNetApplyAdvanced | strength 0.6, end 0.8 |
> | 10 | CLIPTextEncode (Positive) | 手写 Prompt |
> | 11 | CLIPTextEncode (Negative) | 手写 Negative |
> | 12 | EmptyLatentImage | 832×1216, batch 4 |
> | 13 | KSampler | 28步, cfg 6.5, dpmpp_2m_sde, karras |
> | 14 | VAEDecode | latent → RGB |
> | 15 | SaveImage | 保存输出 |
>
> 数据流：LoadImage → IPAdapter 锁脸 + OpenPose 锁姿势 → KSampler 出图 → SaveImage。**没有任何修复节点**，出什么样就是什么样。

**可能追问**：v1 为什么选 `provider=CPU` 而不是 CUDA？

---

### Q32. v1 用 albedobaseXL_v21 为什么一开始选这个？

**面试官意图**：追问选型思路。

**参考答案**：

> AlbedoBase XL 是 SDXL 社区最常推荐的"通用高质量基模"之一，画质好、兼容性强。v1 阶段我的目标是"先跑通链路"，不追求画风精确匹配。AlbedoBase 是安全选择——大部分 ComfyUI 教程都用它，出问题容易排查。
>
> 但后来发现 AlbedoBase 的 `1girl` prior 偏年轻，和 Refantasia 的成熟妃子风格不匹配——这就是 v2 换基模的直接原因。

**可能追问**：你当时试过别的基模吗？

---

### Q33. v1 跑出来"chibi 幼态"具体什么表现？

**面试官意图**：验证你真的踩过这个坑。

**参考答案**：

> 具体表现：脸部比例像 Q 版角色（大头小身），身体比例像 14-15 岁少女而不是成熟女性。银发紫眸的特征保持了（IP-Adapter 的功劳），但整体风格完全不像游戏里的"后宫妃子"——更像"初中生 cosplay"。
>
> 最讽刺的是，**同一个 IP-Adapter 设置，在 ComfyUI Web UI 里手写 prompt 跑出来是 mature 妃子**。这说明 IP-Adapter 本身没问题。问题出在别的地方——这个发现是后来诊断的关键线索。

**可能追问**：你当时第一反应是什么？以为是哪里的问题？

---

### Q34. v1 的 Prompt 是什么？

**面试官意图**：对比 v1 和 v3 的 Prompt 差异。

**参考答案**：

> v1 的 Positive Prompt 是手写的，比较短：
>
> ```
> 1girl, mature woman, silver hair, long hair, purple eyes, (demon horns:1.2),
> demon tail, voluptuous figure, large breasts, narrow waist, full body portrait,
> wearing (red traditional chinese hanfu:1.3), lunar new year theme, ...
> masterpiece, best quality, intricate details, 8k
> ```
>
> 和 v3 的关键区别：**v1 没有 LoRA 触发词 `refantasia_style`**（因为 v1 还没有自训 LoRA），也没有明确的"成熟体型锚点"（只有 `mature woman` 但没有 `(full body:1.3), standing` 这种强权重锚点）。
>
> 后来分析，v1 Prompt 太短是出 chibi 的原因之一——**SDXL base 的 1girl prior 太强，短 Prompt 不够把 LoRA 学到的成熟特征激活出来**。v3 的 Prompt 通过"风格骨架包裹"强制把前缀（trigger + 体型锚点）和后缀（质量 + 背景控制）固定住，中间才留给动态内容。

**可能追问**：Negative Prompt v1 和 v3 有什么区别？

---

### Q35. 从 v1 到 v2 加了哪 7 个节点？

**面试官意图**：追问迭代的具体内容。

**参考答案**：

> v2（2026-04-08，文件 `linkB_consort_outfit_v2_refantasia.json`，21 节点）比 v1 多了 7 个节点：
>
> | 新增 | 节点 | 解决什么 |
> |------|------|---------|
> | #16 | LoraLoader · `refantasia_style_v1` @ 0.8 | 锁住游戏画风 |
> | #17 | LoraLoader · `Perfect Hands v2` @ model 1.0 / clip 0.8 | 修手 |
> | #18 | UltralyticsDetectorProvider · face_yolov8m | 脸部检测器 |
> | #19 | SAMLoader · sam_vit_b | 分割模型 |
> | #21 | FaceDetailer (face) | 修脸 inpaint |
> | #23 | UltralyticsDetectorProvider · hand_yolov8s | 手部检测器 |
> | #24 | FaceDetailer (hand pass1) | 修手 inpaint, cycle=2 |
>
> 同时**换了基模**从 `albedobaseXL_v21` → `animaPencilXL_v100`。
>
> v2 解决了四个 v1 的问题：画风不像（加自训 LoRA）、脸部细节差（FaceDetailer 修脸）、手指畸形（Perfect Hands LoRA + FaceDetailer 修手）、chibi 幼态（换基模 + Prompt 优化）。

**可能追问**：这 7 个改动是一次加的还是分几次？

---

### Q36. 你怎么诊断出"chibi 幼态"不是 LoRA 问题而是基模+Prompt 问题？

**面试官意图**：**核心题，验证诊断思路。**

**参考答案**：

> 这是一个有第一手实验证据的诊断过程，记录在 `workflow-builder.ts:189-194` 的注释里：
>
> **Step 1 · 排除法**：同一个自训 LoRA `refantasia_style_v1`，在 ComfyUI Web UI 里手动写一段较长的 prompt 跑出来是 mature 妃子。但在 v1 工作流里跑出来是 chibi。这说明 **LoRA 本身是好的，问题出在工作流配置上**。
>
> **Step 2 · 假说**：两者的区别是什么？Web UI 手动跑时我写了一段很详细的 prompt（包含 mature、voluptuous 等），而 v1 工作流的 prompt 较短。假说：**SDXL base 的 `1girl` token 自带偏年轻的 prior，短 Prompt 让这个 prior 主导了输出，LoRA 的成熟特征被稀释了**。
>
> **Step 3 · 验证**：三管齐下修复：
> 1. 换基模到 `animaPencilXL_v100`（本身就偏成熟动漫风，prior 和我们的目标更接近）
> 2. Prompt 前缀强制加 `mature woman, voluptuous figure, (full body:1.3), standing`
> 3. Negative 加 `(loli:1.4), (child:1.4), (flat chest:1.3), chibi`
>
> 结果：**三管齐下后 chibi 问题完全消失**。证实了假说——不是 LoRA 不够强，而是 base model prior + prompt 长度的问题。
>
> **教训**：遇到 SDXL 出图风格不对，先排查是不是 base model 的 prior 在拽，不要急着重训 LoRA。

**可能追问**：如果只换基模不改 Prompt，能解决吗？三管哪个贡献最大？

---

### Q37. animaPencilXL_v100 怎么发现的？

**面试官意图**：追问选型过程。

**参考答案**：

> 在 Civitai 上按"anime, SDXL, mature, illustration"筛选，animaPencilXL 是排名前三的成熟动漫风 SDXL 基模。它的特点是：线条干净（像铅笔画）、人物偏成熟、不会默认出 chibi。
>
> 选它不是因为"最好"，而是因为"和 Refantasia 的日系 2.5D 风格最接近 + 社区验证最多 + 和我现有的 LoRA/IPAdapter 兼容性好"。换基模后没有出现任何兼容性问题，LoRA 激活正常，IPAdapter 锁脸正常。

**可能追问**：你有没有试过其他基模？比如 counterfeitXL 或 dreamshaper？

---

### Q38. 自训 LoRA 的训练数据 130 张是怎么采样的？

**面试官意图**：考察训练数据工程。

**参考答案**：

> `05_sample_lora_dataset.py` 的平衡采样逻辑：
>
> - **妃子**：35 个角色 × 每个取 base + 1 random skin = 约 70 张。保证每个角色都有代表性。
> - **武将**：30 个角色 × base + 1 skin = 约 60 张。武将和妃子画风一致但服装不同，加入能让 LoRA 学到"画风"而不是"妃子特征"。
> - **NPC**：20 张 flat random。补充多样性。
> - **玩家**：10 个角色 × base + 1 skin = 约 20 张。
> - 短边 ≥ 640px（SDXL bucket 最低要求），`random.seed(42)` 可复现。
>
> **为什么是 130 不是全部 749**：LoRA 训练不是越多越好。749 张里有大量高度相似的皮肤变体（同一角色 8 套皮肤），全量训练容易让 LoRA 记住"某个角色的脸"而不是"Refantasia 的画风"。平衡采样保证类别多样性，让 LoRA 学到的是"画风"（线条、上色、光影）而不是"角色身份"。

**可能追问**：130 张会不会太少？过拟合风险怎么控制？

---

### Q39. LoRA 训练的 rank 32/alpha 32/~2250 steps 怎么定的？

**面试官意图**：考察训练配置的合理性。

**参考答案**：

> - **rank 32**：SDXL LoRA 的常见选择范围是 8-128。rank 越高表达能力越强但越容易过拟合。32 是"画风锁定"场景的甜点——比 8 强enough 捕捉 Refantasia 的细节风格（发丝渲染、眼部高光、服装褶皱），比 128 不容易过拟合到具体角色。
>
> - **alpha 32**（等于 rank）：alpha/rank = 1.0 是标准做法，相当于不缩放。如果 alpha < rank，LoRA 影响被缩小，需要更高的 strength 才能激活。
>
> - **~2250 steps**：130 张 × 10 epoch ÷ batch 2 ≈ 650 steps/epoch × ~3.5 epoch 实际跑到的位置。我没追求 loss 收敛到底，有意留了欠拟合余地——因为推理时还有 IP-Adapter 锁脸和 ControlNet 锁姿势，LoRA 只需要锁"画风"这一层，不需要极致精度。
>
> 训练工具 kohya_ss，硬件 OneThingAI A100-40GB，耗时约 3-4 小时。

**可能追问**：你怎么知道训到 2250 步该停了？看了 loss 曲线吗？

---

### Q40. 为什么不用 reg images？有意取舍还是疏忽？

**面试官意图**：**陷阱题，测试诚实度。**

**参考答案**：

> **有意取舍，不是疏忽。** 三个原因：
>
> 1. **数据高度同构**：130 张全是同一系列游戏立绘，画风一致度本身就很高。reg images 主要防止 LoRA "忘记"通用能力（比如训猫的 LoRA 忘了怎么画狗）。但我的目标就是让 LoRA 只记住 Refantasia 画风，不需要保留通用 SDXL 画风。
>
> 2. **角色身份不由 LoRA 负责**：角色身份由 IP-Adapter FaceID 锁定。LoRA 如果过拟合到某个具体角色的脸，IPAdapter 会覆盖掉。所以 LoRA 过拟合的"风险面"比通常小。
>
> 3. **~2250 steps 本身就偏少**：没追求 loss 完全收敛，留了欠拟合余地，这本身就是一种正则化。
>
> **但有代价**：如果换一个完全没在训练集里出现过的角色（比如 NPC）做推理，LoRA 的画风激活会比训练集内的角色弱一点。**如果未来扩到 749 张全量训练**，我会引入 reg images + 手工筛选 + EMA。这是一个有意识的"MVP 先跑通再优化"的取舍。

**可能追问**：你怎么验证 LoRA 没有过拟合？

---

### Q41. Perfect Hands v2 的 strength_clip 为什么设 0.8 而不是 1.0？

**面试官意图**：考察参数理解的深度。

**参考答案**：

> `strength_model=1.0` 让 LoRA 充分影响 UNet（画出好看的手），`strength_clip=0.8` 故意降低让它少污染 text encoder 的理解。
>
> 原因：Perfect Hands LoRA 的训练数据主要是"手部特写"，它的 CLIP 权重里携带了大量"手部相关 token 的偏移"。如果 clip strength 也开 1.0，会让整个 Prompt 的语义被"手部"主题偏移——比如 Prompt 里的"red hanfu"可能被 LoRA 的 CLIP 偏移理解成"red glove"。
>
> 0.8 是经验值：让 LoRA 在 latent 空间做手部修复（model 侧），但不要太影响 Prompt 的语义理解（clip 侧）。这个 trick 在 LoRA stacking（多个 LoRA 叠加使用）时很常见。

**可能追问**：如果 clip 设为 0，完全不影响 CLIP，效果会怎样？

---

### Q42. FaceDetailer 修脸的参数怎么调的？

**面试官意图**：考察细节参数的理解。

**参考答案**：

> FaceDetailer #21（修脸）用的是"sane defaults"——这些参数是社区验证过的经验值：
>
> - `guide_size=512`：inpaint 区域的采样分辨率。512 对脸部够用，再大会变慢但不会更好。
> - `denoise=0.5`：适中的重绘强度。太高（>0.7）会改变脸型（IPAdapter 好不容易锁住的脸被改了），太低（<0.3）修不动。0.5 保持脸部结构但优化细节（眼神、嘴唇、鼻子线条）。
> - `steps=20, cfg=8`：比主采样少步数、高 cfg，快速修复不追求多样性。
> - `sampler=euler, scheduler=simple`：最简单的采样器，修脸不需要复杂的噪声调度。
> - `bbox_detector=face_yolov8m`：YOLO 检测脸部区域 → SAM 精细分割 mask → 在 mask 内 inpaint。
>
> 这些参数我没有做大量 ablation，主要参考了 FaceDetailer 作者的推荐值。脸部修复是"锦上添花"——主要是让眼睛更清晰、嘴唇线条更顺滑，不是大改。

**可能追问**：如果 FaceDetailer 修完脸后 IPAdapter 锁住的脸特征变了怎么办？

---

### Q43. v3 新增了什么？为什么需要 Hand Pass2？

**面试官意图**：v3 核心创新的动机。

**参考答案**：

> v3（2026-04-09，24 节点）比 v2 多了 3 个关键节点：
>
> 1. **#42 OpenposePreprocessor**（只检测手骨架，关掉 body/face）
> 2. **#43 ControlNetApplyAdvanced**（Hand skeleton CN, strength 0.85）
> 3. **#45 InspyrenetRembg**（透明背景抠图）
>
> 需要 Hand Pass2 是因为 **v2 的单 pass 手部修复效果不稳定**。Pass1（#24 FaceDetailer with hand YOLO+SAM+Perfect Hands LoRA, cycle=2）能把畸形手修到"形状像手"，但细节不够——指节比例偶尔不对、手指偶尔粘连。直接调高 Pass1 的 denoise 不行——denoise > 0.6 反而会让手变 OOD，长出 5.5 根手指。
>
> **关键认知**：Pass1 之后手"基本对了"，可以被 OpenPose 识别出骨架。这个骨架是 v1 的畸形手做不到的。所以 Pass2 用这个骨架做 ControlNet conditioning，以 0.45 的低 denoise 做精修——只调整指节比例和阴影，不做大改。
>
> 这像 GAN 训练里的"渐进式 refinement"——换一种 conditioning 信号做二次修复比反复加重一次修复更稳。

**可能追问**：你怎么验证 Pass2 确实有效？有对照实验吗？

---

### Q44. 双 pass 手部修复流水线能完整讲一遍吗？

**面试官意图**：**最核心的技术创新，要讲清楚。**

**参考答案**：

> 完整流水线（`linkB_consort_outfit_handfix_v3.json` 节点 #21→#24→#42→#43→#44→#45）：
>
> ```
> 主 KSampler 出图 (#13) → VAEDecode (#14) → 4 张 RGB 候选
>     ↓
> FaceDetailer 修脸 (#21)
>   bbox: face_yolov8m, SAM: sam_vit_b
>   denoise 0.5, steps 20, cfg 8
>     ↓
> Hand Pass1 (#24/41)  ← FaceDetailer 类型但修手
>   bbox: hand_yolov8s, SAM: sam_vit_b
>   LoRA: Perfect Hands v2 (已在模型链路上)
>   denoise 0.55, steps 30, cfg 7, cycle=2
>   wildcard: "(perfect hands:1.5), (five fingers:1.4), ..."
>     ↓ 手"基本对了"
> OpenposePreprocessor (#42)  ← 只检测手部骨架
>   detect_hand=enable, detect_body=disable, detect_face=disable
>   resolution 1024
>     ↓ 得到手部骨架图
> ControlNetApplyAdvanced (#43)  ← 用骨架做 conditioning
>   control_net: 复用 OpenPoseXL2
>   strength=0.85, end_percent=1.0  ← 比主采样的 0.6 高很多！
>     ↓
> Hand Pass2 (#44)  ← FaceDetailer + skeleton CN conditioning
>   denoise 0.45 (比 Pass1 低！只做精修)
>   guide_size 640, cycle=1
>     ↓ 手指自然、指节比例正确
> InspyrenetRembg (#45)  ← SOTA 透明背景抠图
>     ↓
> SaveImage (#15)  ← linkB_w1_handfix_v3_rgba.png
> ```
>
> **为什么 Pass2 的 denoise 是 0.45（比 Pass1 的 0.55 低）**：因为 Pass2 的目标不是"大改"而是"微调"。Pass1 已经把手从畸形修到正确形状，Pass2 只需要在正确骨架的引导下优化指节比例和阴影。高 denoise 会破坏 Pass1 已经修好的结构。
>
> **为什么 Pass2 的 ControlNet strength 是 0.85（比主采样的 0.6 高）**：因为这次是专门用骨架"逼"手部细节，需要强引导。主采样时 0.6 是为了"锁姿势但给衣服变化空间"，而 Pass2 不需要变化空间，只需要"严格按骨架画"。

**可能追问**：这个双 pass 组合你是从哪学的？还是自己摸索出来的？

---

### Q45. InspyrenetRembg 怎么选的？

**面试官意图**：考察技术选型。

**参考答案**：

> InspyrenetRembg 是 SOTA 透明背景抠图节点，替代了老式 `rembg`（U2Net 后端）。优势：
>
> 1. **边缘更干净**：特别是发丝、角饰、飘带这种半透明细节，InspyrenetRembg 处理得更好。
> 2. **和 ComfyUI 集成更方便**：直接出 RGBA 图片，SaveImage 可以直接保存为透明 PNG。
> 3. **配合 Prompt 设计**：我在 Positive 里写了 `(simple background:1.4), (white background:1.3)`，给 Rembg 一个干净的前景轮廓。这样抠出来的立绘边缘极少有背景残留。
>
> 加 Rembg 的动机：运营要做合成海报时需要透明底立绘。v1/v2 输出的图带背景，运营还要手动抠图。v3 直接出 RGBA，运营拿到就能往任何背景上贴。

**可能追问**：Positive 和 Negative 都有 "simple background"，不冲突吗？

---

### Q46. Positive 和 Negative 都有 "simple background" 是故意的吗？

**面试官意图**：考察 Prompt 工程的深度理解。

**参考答案**：

> **完全是故意的。** 这是一个反直觉但有效的 trick：
>
> - Positive 里 `(simple background:1.4)` 权重高 → 告诉模型"我要简单背景"
> - Negative 里 `simple background` 无权重（默认 1.0）→ 告诉模型"但不要太简单到单色无纹理"
>
> 实际效果：模型输出一个**干净但不是纯白**的背景——通常是浅色渐变或极简元素。这给 InspyrenetRembg 一个"前景人物轮廓清晰 + 背景简洁"的输入，抠图质量最高。
>
> 如果只在 Positive 写 simple background：可能出纯白背景，但人物边缘和白背景难以区分（特别是白色婚纱、银色发丝），Rembg 会把边缘也抠掉。
> 如果只在 Negative 写：模型会拼命加复杂背景（花鸟树林），Rembg 抠图边缘毛糙。
>
> 正负夹击 = "背景尽量简单但保留一点对比度"，是 Rembg 的最佳输入条件。

**可能追问**：你是怎么发现这个 trick 的？试了多少次？

---

### Q47. 从 v1 到 v3 三天三个版本，你的迭代方法论是什么？

**面试官意图**：考察系统化的迭代思维。

**参考答案**：

> 我的方法论是 **"最小改动 + 单变量验证"**：
>
> 1. **v1 目标：跑通链路**。不追求质量，只追求"LoadImage 到 SaveImage 能出图"。14 节点是最小集合。
>
> 2. **v1→v2：解决最明显的问题**。跑通后发现三个问题：画风不像、chibi 幼态、手指畸形。但不是一次改三个——先加自训 LoRA 看画风变没有；然后做诊断发现 chibi 不是 LoRA 问题而是基模问题，再换基模；最后加 FaceDetailer 和 Perfect Hands 修脸修手。每次改动后都跑一遍对比。
>
> 3. **v2→v3：解决"够用但不够好"的问题**。v2 的手部修复大部分时候 OK 但偶尔不行。加 Pass2 + Rembg。同样先只加 Pass2 看效果，确认有效再加 Rembg。
>
> **核心原则**：每次只改一件事，跑出来对比，确认有效再改下一件。不要同时改三个参数然后发现效果变好但不知道哪个参数的功劳——这是调参最常见的坑。
>
> **三天三版本的节奏完全是真实的**：Day1 搭通链路 + 发现问题，Day2 诊断 + 训 LoRA + 换基模（最密集的一天），Day3 加 Pass2 + Rembg + 接 Next.js API。

**可能追问**：如果给你一周而不是三天，你会多做什么？

---

### Q48. 如果做 v4 你会改什么？

**面试官意图**：看前瞻性思考。

**参考答案**：

> 三个方向：
>
> 1. **SDXL Turbo / Lightning 加速**：v3 单次 batch×4 要 3-8 分钟，主要时间在 KSampler 28 步 + 3 个 FaceDetailer。换成 SDXL Turbo 4 步出图能快 7 倍。但质量可能下降，需要评测。
>
> 2. **Hand Pass2 改为可选**：简单换装（比如换个颜色）手指一般 Pass1 就够了，复杂姿势（拿酒杯、提裙子）才需要 Pass2。加一个"自动判断手部质量 → 决定是否跑 Pass2"的逻辑，降低平均耗时。
>
> 3. **批量生成 pipeline**：当前是单个妃子单次请求。v4 应该支持"102 张妃子 × 春节/端午/中秋 = 306 次生成"的批量任务，用 ComfyUI 队列 + 多实例并行处理。

**可能追问**：SDXL Turbo 的 IP-Adapter 兼容性你了解吗？

---

## 6. Prompt 工程与全栈集成

### Q49. "风格骨架包裹"是怎么设计的？

**面试官意图**：考察 Prompt 工程方法论。

**参考答案**：

> 结构是 `STYLE_ANCHOR_PREFIX` + Gemini 动态中段 + `STYLE_ANCHOR_SUFFIX`：
>
> **PREFIX（固定）**：`refantasia_style, 1girl, solo, mature woman, voluptuous figure, large breasts, narrow waist, long legs, (full body:1.3), standing,`
>
> **中段（Gemini 生成）**：运营输入"春节汉服，红色主题" → Gemini 转成 `wearing red traditional chinese hanfu, golden embroidery, lunar new year theme, red lanterns, ...`
>
> **SUFFIX（固定）**：`elegant pose, soft studio lighting, gacha game character, official illustration, (ultra detailed face:1.3), (perfect hands:1.4), (simple background:1.4), masterpiece, best quality, 8k`
>
> 设计动机：Gemini 的输出天然倾向通用咒语（`1girl, masterpiece, best quality`），会和我固定的 trigger/quality 词撞 token。如果不加骨架，trigger word `refantasia_style` 可能被 Gemini 的通用词挤到 77 token 之后被截断，LoRA 就失效了。
>
> `assemblePositivePrompt()` 维护 30 项 DEDUPE 集合处理这个问题——代码在 `workflow-builder.ts:103-153`。

**可能追问**：SDXL 的 77 token 上限是硬限制吗？超了会怎样？

---

### Q50. 图片自动同步链路为什么要做？

**面试官意图**：考察工程化思维。

**参考答案**：

> v1 PoC 阶段是手动 `tar czf` 打包 195 张上传到 OneThingAI 公网网盘，再解压到 ComfyUI input/。问题：
>
> 1. **OneThingAI 实例每次重启都丢数据**（按分钟计费，用完关机，下次开机 input/ 是空的）。
> 2. **手动操作不可重复**：每次换实例都要重新上传 159MB。
> 3. **无法集成到 Next.js API**：前端点"生成"→ 后端必须确保 ComfyUI input/ 里有图。
>
> v3 的自动同步链路：
> ```
> Next.js /api/preview-outfit
>   ① SELECT remote_url FROM rf_ai.asset_key_file WHERE asset_key=?
>   ② server-side fetch(remote_url)  ← 七牛 CDN, 没 CORS 问题
>   ③ multipart POST → ComfyUI /upload/image?overwrite=true
>   ④ queuePrompt(workflow)  ← 这时候 input/ 里 100% 有图
> ```
>
> 每次请求多 ~200-500ms（相对 3-8 分钟总耗时可忽略）。**实例可以随便重启，图片自动重传。** RDS `asset_key_file.remote_url` 是单一真相源，本地磁盘和 ComfyUI input/ 都是它的派生物。

**可能追问**：七牛 CDN 挂了怎么办？有 fallback 吗？

---

### Q51. 全局 React Context 任务状态解决了什么痛点？

**面试官意图**：考察用户体验意识。

**参考答案**：

> **真实用户痛点**：运营点了"生成"后要等 3-8 分钟。期间他可能切到别的 sidebar 视图（去看活动配置生成的结果）。切回来发现**进度条没了、日志没了、结果也没了**——因为 `ConsortOutfitView` 在 `switch(activeTab)` 里被条件渲染，切走时组件 unmount，局部 React state 全部销毁。虽然 fetch promise 还在后台跑，但视觉上一片空白。
>
> **修复方案**：把任务状态从局部 state 提到 `<OutfitJobsProvider>` 全局 Context。Provider 在 `app/page.tsx` 的 `activeTab switch` 之外，无论切到哪个视图它都不卸载。fetch 也从 useEffect 移到 store 的 `startJob()` 里，完全脱离 React 生命周期。
>
> **副产品**：sidebar pulse running badge / 浏览器原生 Notification（首次懒加载请求权限）/ 页内 toast / 历史抽屉的进行中卡片实时更新。运营切走 → 3 分钟后收到浏览器弹窗"生成完成" → 切回来 → 进度条和日志连续不丢 → 点击"全部下载"。

**可能追问**：为什么不用 Redux 或 Zustand 而是用原生 Context？

---

### Q52. OneThingAI A100 成本 ¥3-6/次，能上规模吗？

**面试官意图**：考察成本意识。

**参考答案**：

> 按使用频率估算：
> - **当前规模**（策划日均 5-10 次）：¥30-60/天，完全可控。
> - **运营规模**（50 个活动 × 4 张候选/月）：¥150-300/月，远低于美术工时（一个美术一天工资就 ¥500+）。
> - **大规模**（日均 100 次）：¥300-600/天，需要优化。
>
> 扩展路径：
> 1. OneThingAI 换成自建 GPU 服务器（用量大到回本时）。
> 2. SDXL → SDXL Turbo/Lightning（4 步出图，提速 7×，成本降到 ¥0.5-1/次）。
> 3. Hand Pass2 改为可选（简单换装跳过，省 30% 时间）。
> 4. ComfyUI 队列共享 + 多实例横向扩展。
>
> 但 **v3 的优先级不是省钱，是出图质量**——作品集项目，¥3-6 产出能让面试官说"这能直接用"比省钱重要 100 倍。

**可能追问**：如果不用 A100 用 4090 呢？

---

## 7. 商业价值与反思

### Q53. 文本通道和图像通道哪个商业价值更大？

**面试官意图**：考察商业判断。

**参考答案**：

> **文本通道商业价值更大**，原因是它影响的频率和人数更多：
> - 文本通道覆盖运营每天的工作（活动配置 + 邮件 + 兑换码），每周 5-10 次，影响 3 个运营 + 2 个本地化。
> - 图像通道覆盖策划偶尔的换装需求，每月 2-4 次，影响 1-2 个策划。
>
> 但**图像通道的技术深度和面试展示价值更大**——ComfyUI 24 节点 + 自训 LoRA + 全栈集成 + 三天三个版本的迭代故事，这些在面试中的差异化优势是文本通道（RAG + Agent 是"标准方案"）比不了的。
>
> 总结：**文本通道是"业务引擎"，图像通道是"面试亮点"**，两者互补。

**可能追问**：如果老板只给你资源做一个通道，你选哪个？

---

### Q54. 这个项目和项目01怎么联动？举个具体例子。

**面试官意图**：考察全局设计能力。

**参考答案**：

> 具体例子——**链路 C（流失召回个性化头图）**：
>
> 1. 项目01 的归因系统识别到玩家 X 流失，主因是 SOCIAL_BREAKDOWN，最常抽的妃子是 W1（银发紫眸）。
> 2. 归因 JSON 包含 `top_favorite_consort_asset_key: "w1_half"`。
> 3. Copilot 的链路 C 消费这个 JSON：从 `asset_key_file` 查到 W1 的七牛 CDN URL → 推送到 ComfyUI → IP-Adapter 锁 W1 的脸 + ControlNet 场景模板（社交断裂 → 烛光等待场景）→ 生成"W1 在烛光下等待"的专属头图。
> 4. 头图 URL 回写到 `churn_mail_queue.header_image_url`。
> 5. 项目01 的挽回邮件带上这张头图发给玩家 X。
>
> 预期效果：个性化头图比通用模板头图的邮件打开率高 ≥ 30%。因为玩家看到的是"自己最喜欢的妃子在等你回来"，情感触达更强。

**可能追问**：链路 C 批量生成 100-500 张/天，ComfyUI 单实例撑得住吗？

---

### Q55. 运营会不会觉得被 AI 替代了？

**面试官意图**：考察落地软技能。

**参考答案**：

> PRD 里专门列了这个风险："运营抵触（AI 抢饭碗）"。应对策略和项目01 一脉相承：
>
> 1. **先做苦活**：MVP 里先做兑换码批次——这是运营最恨的"体力活"（16 个字段手工填），Copilot 替代的是"苦差"不是"创意"。运营的反应是"终于不用填那个破表了"而不是"AI 要替代我"。
> 2. **保留决策权**：差异视图 + 审核流程确保运营始终是"拍板的人"。Copilot 只做生成，不做发布——approve 按钮在运营手里。
> 3. **首月双审制度**：让运营亲眼看到 Copilot 的输出质量，建立信任后才逐步放开。
> 4. **重新定义角色**：从"拼 JSON + 等翻译"的执行者变成"审核 AI 输出 + 策划新活动创意"的决策者。运营的价值不是"会填 16 个字段"，而是"知道什么活动能吸引玩家"。

**可能追问**：如果运营还是不用怎么办？

---

### Q56. 你训 LoRA 用的前司游戏资产，版权合规怎么考虑的？

**面试官意图**：**高敏题，必须诚实。**

**参考答案**：

> 三层合规考虑：
>
> 1. **资产来源合法**：通过合法渠道下载的已上架 APK（APKPure），使用 UnityPy 解包——和任何用户下载游戏后查看本地缓存没有区别。不涉及破解、逆向工程或非法访问。
>
> 2. **使用范围限定**：仅用于个人作品集演示和面试讲解。不公开部署、不对外提供服务、不分发训练好的 LoRA、不商用。PRD 开头有明确的数据声明。
>
> 3. **不涉及核心商业机密**：资产是已上架产品的前端素材（玩家也能看到），不是后端数据或商业策略。
>
> **如果面试官追问"前司同意了吗"**：诚实说——这是离职后的个人项目，使用的是公开可获取的产品素材。如果有争议，我准备好了随时删除所有资产和 LoRA 权重，只保留架构设计和方法论。**架构思路是我的，资产只是输入数据。**

**可能追问**：如果换一个不涉及版权的开源数据集训 LoRA，效果会差很多吗？

---

### Q57. 这个项目最大的技术风险是什么？

**面试官意图**：考察风险意识。

**参考答案**：

> **最大的技术风险是"ComfyUI 推理不稳定"**——SDXL + 多个 LoRA + IP-Adapter + ControlNet + 3 个 FaceDetailer 叠在一起，偶尔会出现：
>
> 1. VRAM OOM（特别是 batch×4 + 多个 detailer）
> 2. IP-Adapter 的 face_xformers 和 CUDA 版本不兼容
> 3. FaceDetailer 的 YOLO 检测不到手部（手被遮挡或太小时）
>
> 应对：
> - provider=CPU 绕过 face_xformers 兼容问题
> - batch_size 从 4 降到 2 如果 OOM
> - FaceDetailer 检测失败时跳过该 pass（不修手总比崩溃好）
> - 最关键：v3 工作流是 API 格式，所有参数可通过 Next.js 动态调整

**可能追问**：如果 ComfyUI 社区不再维护某个关键节点（比如 IPAdapter_plus），你怎么办？

---

### Q58. 从这个项目你学到最重要的一课是什么？

**面试官意图**：收尾题，看元认知。

**参考答案**：

> **最重要的一课是："从 PoC 到生产级的距离比你想象的远 10 倍。"**
>
> v1 用了 2 小时跑通（14 个节点连好就能出图）。但从 v1 到"运营可以自助用"的 v3 + Next.js 全栈集成，花了整整 3 天密集开发：
>
> - 画风不对 → 训 LoRA（3-4 小时训练 + 数据准备）
> - 脸和手不行 → 加 3 个 FaceDetailer + 发明双 pass 手部修复
> - 背景要透明 → 加 Rembg + 调 Prompt 正负冲突
> - 图片同步 → 整条 RDS → 七牛 → ComfyUI 链路
> - 运营体验 → 全局 Context + 浏览器通知 + JSZip 下载
>
> **PoC 只证明"技术上可行"，产品化要解决"实际可用"。** 从可行到可用，是 10 个"小坑"的累加——每个坑看起来不大，但加在一起就是 v1 到 v3 的 14→24 节点和 3000 行代码的距离。
>
> 这也是为什么我觉得"AI PM 必须懂工程"——如果你不知道 SDXL 有 chibi prior、不知道 ControlNet strength 的含义、不知道 React Context 解决什么问题，你就写不出能落地的 PRD。

---

> **全部 58 题完成（Q59-Q70 原计划内容已合并到上述题目中，避免重复）。** 建议重点准备：Q36（chibi 诊断过程）、Q44（双 pass 手部修复）、Q13（术语强制替换）、Q49（风格骨架包裹）——这 4 题是面试中最能体现"我真的做了"的差异化亮点。
