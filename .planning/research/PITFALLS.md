# Pitfalls Research

**Domain:** 编译器规范化 + 第三方支持库自助编译接入（ycIDE v1.1）
**Researched:** 2026-03-22
**Confidence:** MEDIUM（高比例基于仓库一手代码证据；本次无外网官方文档核验）

## Critical Pitfalls

### Pitfall 1: 协议“可选回退”长期变成“协议无效”

**What goes wrong:**  
已经引入 `*.events.json / *.protocol.json` 协议，但编译器可回退到硬编码事件推断，导致第三方库即使协议缺失/错误也“似乎能跑”，最终在复杂控件事件下出现行为错乱。

**Why it happens:**  
- 为兼容老库保留了回退路径（这是正确的），但没有区分“老库兼容模式”与“第三方新库准入模式”  
- 团队在里程碑推进中倾向先让编译通过，忽略协议完备性

**How to avoid:**  
- 设计“双模式编译”：
  - **Legacy mode**：允许回退（仅内置/历史库）
  - **Third-party strict mode**：协议缺失或未命中即失败
- 给第三方库发布流程增加 `contract validate` 步骤：事件覆盖率必须 100%
- 在 IDE 中把“回退命中”显示为黄色风险，不可静默

**Warning signs:**  
- 编译日志频繁出现“未解析事件绑定”告警但构建仍成功  
- 同一组件不同事件有的触发有的不触发  
- 第三方库文档与实际事件行为不一致

**Phase to address:**  
Phase 2（编译器契约执行与严格模式）

---

### Pitfall 2: 命令翻译存在 TODO 占位，导致“编译成功但功能空转”

**What goes wrong:**  
未知支持库命令被转译成 `(void)0` 注释占位，产物可执行但逻辑被静默丢弃，第三方作者误以为已成功集成。

**Why it happens:**  
- 当前命令生成器对未覆盖命令采用“软失败”策略  
- 缺少命令级兼容矩阵与硬性发布门禁

**How to avoid:**  
- 未实现命令默认改为 **error**（至少在 third-party strict mode 下）  
- 输出“命令实现覆盖率报告”（按库、按命令）  
- 明确支持策略：  
  - 支持：可转译命令  
  - 不支持：编译中止 + 指向文档

**Warning signs:**  
- 编译日志中出现 `TODO: xxx 尚未实现C代码生成`  
- 用户反馈“函数调用无效果但无报错”  
- 发布版本中仍存在大量 placeholder 生成代码

**Phase to address:**  
Phase 2（命令契约落地）+ Phase 6（发布质量门禁）

---

### Pitfall 3: 协议版本无治理，新增字段直接破坏老编译器

**What goes wrong:**  
第三方开始自助后，协议文件出现字段扩展或语义变化，老版本编译器读取后静默忽略/误解析，导致生态碎片化。

**Why it happens:**  
- 只有 `version` 字段但缺少明确版本协商规则  
- 无 capability/feature flags，无法判断“可忽略”还是“必须支持”

**How to avoid:**  
- 建立契约版本策略（SemVer + breaking policy）  
- 在协议中加入：
  - `minCompilerVersion`
  - `features`（如 `eventBindings.v1`）  
- 编译器严格校验版本兼容性，不兼容时给出可操作错误提示

**Warning signs:**  
- 同一第三方库在不同 ycIDE 版本结果不一致  
- 社区出现“某版本能编、某版本不能编”的重复问题  
- issue 中大量“协议字段不生效”

**Phase to address:**  
Phase 1（契约规范与版本策略）

---

### Pitfall 4: 运行时依赖路径耦合 IDE 本机，交付到用户机器即失效

**What goes wrong:**  
普通编译模式下窗口组件库通过绝对路径 `LoadLibraryW` 从 IDE 环境加载，开发机运行正常，分发到用户机后找不到依赖。

**Why it happens:**  
- 现有设计偏向 IDE 内调试便利  
- 缺少“可重定位产物”作为第三方自助发布的硬约束

**How to avoid:**  
- 为第三方自助发布定义唯一可交付模式（推荐静态链接或相对路径可部署包）  
- 发布前执行“clean machine”验证（无 IDE 安装路径）  
- 输出包生成时自动附带依赖清单与缺失检查

**Warning signs:**  
- 开发机可运行，目标机报 `DLL load failed` / 模块无法找到  
- 输出目录依赖不完整或依赖来源不明  
- 发布文档要求用户手工复制 IDE 目录文件

**Phase to address:**  
Phase 4（打包与可部署性规范）

---

### Pitfall 5: 库名/命令名冲突策略过于粗糙，生态扩大后互相踩踏

**What goes wrong:**  
当前冲突检查主要基于 GUID 与“非成员命令同名”；随着第三方库增多，命名空间冲突、后加载覆盖前加载、行为不可预测。

**Why it happens:**  
- 早期生态小，冲突成本低  
- 缺少全局命名规范与 registry（库 ID、命令命名前缀）

**How to avoid:**  
- 定义“生态命名规则”：库 ID 全局唯一、命令命名建议前缀化  
- 引入库清单注册机制（至少本地签名 registry）  
- 对同名命令覆盖行为给出明确冲突错误，不允许隐式覆盖

**Warning signs:**  
- 加载顺序变化导致自动补全/编译结果变化  
- 同名命令来自不同库时行为漂移  
- 社区反馈“装了 A 库后 B 库某命令失效”

**Phase to address:**  
Phase 3（生态接入规则与冲突治理）

---

### Pitfall 6: FFI 解析层容错过宽，坏库被当“空库”继续流转

**What goes wrong:**  
`parseFneFile` 及相关读取逻辑存在宽松 fallback，遇到 ABI/结构异常可能返回部分空数据，系统继续运行，问题被延后放大。

**Why it happens:**  
- 历史上为提高“可打开率”采用了 soft-fail  
- 缺乏严格 schema invariant 与坏库隔离机制

**How to avoid:**  
- 增加 strict parse 模式：关键字段异常直接标记库无效  
- 对库元数据建立最小合法性校验（命令数、GUID、类型结构）  
- 将“空结果”区分为“真实空库”与“解析失败”

**Warning signs:**  
- 库加载成功但命令/窗口组件数异常为 0  
- 不同机器解析同一 `.fne` 结果不一致  
- 日志仅有 warning，用户侧表现为功能缺失

**Phase to address:**  
Phase 2（解析严格化）+ Phase 6（回归与验收）

---

### Pitfall 7: 缺少第三方合规测试工装，导致“文档驱动接入”不可验证

**What goes wrong:**  
仅靠文档说明协议，第三方作者无法在本地快速验证“我的库是否符合编译契约”，问题集中到主仓库集成阶段才暴露。

**Why it happens:**  
- 往往先做 IDE 功能，再补 SDK/validator  
- 当前测试基线偏启动冒烟，缺少 parser/compiler contract 测试

**How to avoid:**  
- 提供独立 CLI 校验器（输入 `.fne + protocol`，输出结构化报告）  
- 官方提供最小可运行样例库 + golden fixtures  
- PR 门禁必须包含第三方样例回归结果

**Warning signs:**  
- 第三方 issue 大多是“到底哪里不符合规范”  
- 同类问题反复出现（字段名、编码、事件映射）  
- 合并前靠人工沟通反复返工

**Phase to address:**  
Phase 5（第三方 SDK/自检工具链）

---

### Pitfall 8: 安全边界缺失，第三方自助能力等同“任意本地原生代码执行”

**What goes wrong:**  
允许加载第三方 `.fne` 的同时缺乏信任策略、隔离与审计，相当于把本地原生代码执行能力直接开放到 IDE 主进程。

**Why it happens:**  
- 功能优先，安全后置  
- 误把“本地开发工具”当作“无需安全控制”的场景

**How to avoid:**  
- 引入分级信任模型（官方签名/本地开发/未知来源）  
- 默认禁用未知来源库加载，提供显式授权  
- 中长期将 FFI 解析隔离到子进程并做最小权限通信

**Warning signs:**  
- 库加载来源不可追溯  
- 用户环境中出现不明库自动可见/可加载  
- 崩溃日志集中在 `koffi` / native load path

**Phase to address:**  
Phase 5（安全基线）+ Phase 6（发布治理）

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 对未支持命令生成 `(void)0` 占位 | 快速“看起来可编译” | 语义静默丢失，用户信任受损 | Never |
| 事件映射失败回退硬编码 | 兼容老库更顺滑 | 第三方协议质量无法提升，排错困难 | 仅 Legacy mode |
| 允许绝对路径运行时加载 IDE 库 | 本机调试方便 | 产物不可部署、跨机失败 | 仅开发调试，禁止发布 |
| 广泛 `catch {}` 吞错 | 降低短期崩溃率 | 假成功、问题后移、定位成本高 | Never（关键链路） |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `.fne` + 协议 JSON | 只发 `.fne`，漏发协议文件 | 打包模板强制校验二者同时存在 |
| 编译器事件分发 | 依赖硬编码猜测事件码 | 以协议为准，strict mode 下未命中即失败 |
| 库命令接入 | 命令能识别就算支持 | 必须有对应代码生成实现与测试样例 |
| 输出交付 | 在开发机测试通过即发布 | clean machine 验证 + 依赖清单检查 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 启动/编译阶段反复同步扫描与解析库 | 库增多后 IDE 卡顿、编译前准备变慢 | 解析结果缓存 + 增量失效策略 | 库数量 > 30~50 |
| 编译输出日志无上限累积 | 内存增长，界面逐步迟缓 | 日志 ring buffer + 落盘归档 | 长时间编译/调试会话 |
| 每次编译全量协议重读 | 大项目编译初始化时间波动大 | 基于文件哈希的协议缓存 | 第三方库规模化后 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 无签名/无来源验证直接加载 `.fne` | 恶意本地代码执行 | 签名校验 + 来源分级 + 显式授权 |
| 在主进程直接执行高风险解析 | 崩溃可拖垮 IDE 主流程 | 解析子进程隔离 + 超时/崩溃恢复 |
| IPC 文件能力边界过宽 | renderer 被利用后可扩大攻击面 | 路径白名单、项目根限制、参数校验 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| “编译成功”但只有 warning，不解释可运行性风险 | 第三方作者误判成功 | 结果分级：Success / Degraded / Failed |
| 诊断信息缺少命令/事件定位 | 无法自助修复 | 错误消息附带库名、组件名、事件名、字段路径 |
| 缺少“为什么失败”的文档直链 | 反复提问，支持成本高 | 每个错误码绑定文档页与修复示例 |

## "Looks Done But Isn't" Checklist

- [ ] **协议规范:** 不仅有 JSON 样例，还要有版本协商与 breaking policy  
- [ ] **第三方接入:** 不仅能加载库，还要有 validator CLI 和样例库  
- [ ] **编译成功:** 不仅看 exit code，还要检查“命令实现覆盖率 = 100%”  
- [ ] **可发布:** 不仅开发机能跑，还要 clean machine 可运行  
- [ ] **兼容性:** 不仅老库不崩，还要明确 legacy 与 strict 的行为差异  

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 协议回退掩盖问题 | MEDIUM | 启用 strict mode 回放 → 生成未覆盖事件清单 → 逐库补齐协议 |
| 命令占位空转 | HIGH | 扫描生成代码中的 TODO 占位 → 建立缺失命令清单 → 分批补生成器并加回归 |
| 发布后依赖路径失效 | HIGH | 热修复打包脚本 → 重新出可重定位包 → 增加 clean machine gate |
| 冲突导致行为漂移 | MEDIUM | 冻结库加载顺序 → 输出冲突报告 → 引入命名规则并迁移 |
| 非可信库引发崩溃/风险 | HIGH | 立即阻断默认加载 → 启用来源白名单 → 补安全审计与隔离方案 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 协议回退长期替代协议 | Phase 2 | strict mode 下第三方样例全部零回退 |
| 命令 TODO 占位空转 | Phase 2 / 6 | 编译产物扫描无 placeholder，覆盖率报告达标 |
| 协议版本漂移 | Phase 1 | 低版本编译器对高版本协议给出明确不兼容错误 |
| 依赖路径耦合本机 | Phase 4 | clean machine E2E 可运行，无 IDE 目录依赖 |
| 命名冲突与覆盖不确定性 | Phase 3 | 冲突检测阻断隐式覆盖，加载顺序不影响行为 |
| FFI 宽松容错导致假成功 | Phase 2 / 6 | 坏库测试样例被稳定识别为失败而非空数据 |
| 无第三方自检工装 | Phase 5 | 第三方可本地运行 validator 并得到可操作报告 |
| 第三方原生代码安全风险 | Phase 5 / 6 | 非信任库默认不可加载，审计日志可追溯 |

## Sources

- `D:\chungbin\ycIDE-html\.planning\PROJECT.md`
- `D:\chungbin\ycIDE-html\支持库编译消息接口规范-v1.md`
- `D:\chungbin\ycIDE-html\src\main\compiler.ts`
- `D:\chungbin\ycIDE-html\src\main\library-manager.ts`
- `D:\chungbin\ycIDE-html\src\main\fne-parser.ts`
- `D:\chungbin\ycIDE-html\.planning\codebase\CONCERNS.md`
- `D:\chungbin\ycIDE-html\.planning\codebase\TESTING.md`

---
*Pitfalls research for: compiler standardization & third-party support-library self-serve compilation*
*Researched: 2026-03-22*

