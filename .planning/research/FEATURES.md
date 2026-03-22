# Feature Research

**Domain:** 编译器规范化下的第三方支持库自助编译（v1.1 增量能力）  
**Researched:** 2026-03-22  
**Confidence:** MEDIUM（仓库内证据 HIGH；“行业典型”判断因离线无法外部核验，LOW-MEDIUM）

## Feature Landscape

### Table Stakes (Users Expect These)

> 仅列本里程碑“新增行为”，不重复已有能力（扫描/加载/冲突检查、基础编译运行、迁移工具链）。

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 稳定编译契约 Schema（version + 必填字段 + 兼容规则） | 第三方要“可自助”，首先要有明确且可校验的契约，而不是口口相传 | HIGH | 基于现有 `eventBindings` 协议升级为“可验证规范”：明确字段必填/可选、未知字段策略、版本演进策略；必须包含破坏性变更约束。 |
| 契约校验与错误分级（error/warn/info） | 没有校验器，第三方只能靠编译失败反推问题，体验极差 | MEDIUM | 在编译前执行协议校验：如 `WM_COMMAND/WM_NOTIFY` 缺 `code` 直接报错；无法解析事件绑定给出可定位警告（现有编译器已有 warning 基础）。 |
| 标准化产物打包契约（`.fne` + 协议 JSON + 架构声明） | 生态可扩展的前提是“交付物结构固定”，否则每库都要手工适配 | MEDIUM | 固化同目录发现顺序（已存在：`.events/.protocol/.compile-protocol.json`）并补充“必带文件清单”和“x86/x64 产物矩阵”。 |
| 第三方一键构建工作流（脚手架命令 + 示例模板） | “可用”不等于“好用”；没有标准流程会回到每家私有脚本 | HIGH | 参考 `支持库源码/build-all-support-libs.ps1` 的可复用模式，抽象成对外最小命令集：初始化、构建、验收、打包。 |
| 兼容性守门（旧库兜底 + 新库强约束） | 当前生态已有大量库，不能因标准化一次性打断 | HIGH | 维持现有“协议未命中→硬编码回退”用于存量兼容，但新增第三方接入应要求“协议齐全”才能通过发布验收。 |
| 契约合规验收（加载冲突 + 编译链接 + 事件分发） | 第三方最关心“发出去能不能被 IDE 真正使用” | MEDIUM | 复用现有加载冲突检查（GUID/命令名）+ 编译参数矩阵（x86/x64、static/normal）+ 事件绑定解析结果，形成统一验收报告。 |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 协议脚手架自动生成（从 FNE 元信息预填 eventBindings） | 大幅降低第三方首次接入门槛，减少漏配字段 | HIGH | 从窗口组件元数据反推 `unit/unitEnglishName/event` 初稿，作者只补 `channel/code`。 |
| “兼容性徽章”输出（Contract Pass / x64 Pass / Legacy Safe） | 让第三方发布质量可视化，提升社区信任 | MEDIUM | 验收后自动生成机器可读结果（JSON）+ 人类可读摘要（Markdown）。 |
| 失败可修复建议（诊断 -> 建议 patch） | 比“报错”更进一步，直接告诉作者怎么改 | HIGH | 例如未解析事件时给出建议协议片段模板，减少文档来回查找。 |
| 最小可发布模板仓（含 CI 示例） | 让外部作者复制即用，减少“环境搭建”摩擦 | MEDIUM | 提供标准目录、构建脚本、发布清单，建议后续阶段补充。 |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 为每个新库继续加编译器硬编码映射 | 短期见效快 | 长期不可维护，完全违背“第三方自助”目标 | 严格走协议契约，硬编码仅作存量过渡兜底 |
| 支持“无协议发布” | 让老库接入更省事 | 运行时事件失配难定位，质量不可控 | 允许本地编译警告，但发布验收必须协议完整 |
| 自由扩展任意 JSON 字段并立即生效 | 作者希望灵活 | 会造成契约碎片化，版本无法治理 | 引入 `version` + 扩展区命名规则 + 审核后纳入正式规范 |
| 首版就覆盖多平台（Windows/Linux/macOS）第三方构建 | 看起来“更先进” | 当前工具链和目标明确是 Windows x64，过早扩展稀释主目标 | v1.1 专注 Windows；跨平台留到后续独立里程碑 |

## Feature Dependencies

```text
[稳定编译契约 Schema]
    └──requires──> [契约校验与错误分级]
                        └──requires──> [契约合规验收]

[标准化产物打包契约]
    └──requires──> [第三方一键构建工作流]
                        └──requires──> [契约合规验收]

[兼容性守门（旧库兜底 + 新库强约束）]
    └──gates──> [第三方一键构建工作流]
    └──gates──> [契约合规验收]

[协议脚手架自动生成]
    └──enhances──> [第三方一键构建工作流]
```

### Dependency Notes

- **契约校验依赖稳定 Schema：** 没有统一 schema 就无法定义“什么是合格输入”。  
- **一键构建依赖打包契约：** 没有固定产物结构，脚本无法稳定自动化。  
- **合规验收依赖校验与兼容策略：** 既要保证新库质量，也要避免破坏存量。  
- **脚手架生成是增强项：** 能显著降门槛，但不是 v1.1 发布阻塞项。  

## MVP Definition

### Launch With (v1.1)

- [ ] **稳定编译契约 Schema + 版本规则** — 没有它就不存在“标准化”  
- [ ] **契约校验器（编译前）+ 错误分级输出** — 没有它第三方无法自助排错  
- [ ] **标准化打包与发布清单** — 没有它 IDE 侧无法稳定识别  
- [ ] **第三方一键构建最小流程** — 让外部作者“第一次就能跑通”  
- [ ] **兼容性守门策略（旧库兜底，新库强约束）** — 保证平滑演进  

### Add After Validation (v1.1.x)

- [ ] **协议脚手架自动生成** — 当手工补协议成为主要瓶颈时引入  
- [ ] **兼容性徽章与机器可读报告** — 当第三方库数量增长后用于治理  

### Future Consideration (v2+)

- [ ] **修复建议自动 patch 生成** — 成本高，适合生态规模扩大后投入  
- [ ] **跨平台第三方构建支持** — 与当前 Windows 主目标冲突，暂缓  

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| 稳定编译契约 Schema + 版本规则 | HIGH | HIGH | P1 |
| 契约校验器 + 错误分级 | HIGH | MEDIUM | P1 |
| 标准化打包与发布清单 | HIGH | MEDIUM | P1 |
| 第三方一键构建最小流程 | HIGH | HIGH | P1 |
| 兼容性守门策略 | HIGH | HIGH | P1 |
| 协议脚手架自动生成 | MEDIUM | HIGH | P2 |
| 兼容性徽章与报告 | MEDIUM | MEDIUM | P2 |
| 自动 patch 建议 | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

> 说明：当前环境无法在线检索官方外部资料，以下为“跨生态通用模式”对照，置信度 LOW。

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| 契约版本化 | 多采用 manifest/schema version + 向后兼容策略 | 多采用 semver + deprecation 窗口 | 采用 `version` 字段 + 破坏性变更门禁 |
| 一键构建 | 通常提供官方 CLI（init/build/package） | 通常提供模板仓 + CI 示例 | 先提供最小脚本链路，后补 CLI/模板增强 |
| 生态验收 | 常见 lint + build + publish 前检查 | 常见 registry 侧校验 | 在 ycIDE 侧先落实“加载/编译/事件”合规三联验收 |

## Sources

- `D:\chungbin\ycIDE-html\.planning\PROJECT.md`（里程碑目标与边界，HIGH）  
- `D:\chungbin\ycIDE-html\支持库编译消息接口规范-v1.md`（现有协议字段与行为，HIGH）  
- `D:\chungbin\ycIDE-html\src\main\compiler.ts`（协议发现顺序、事件回退、x86/x64、UTF-8 编译参数、链接策略，HIGH）  
- `D:\chungbin\ycIDE-html\src\main\library-manager.ts`（扫描加载、GUID/命令冲突检查、静态库发现，HIGH）  
- `D:\chungbin\ycIDE-html\src\main\index.ts`（library/compiler IPC 能力边界，HIGH）  
- `D:\chungbin\ycIDE-html\支持库源码\build-all-support-libs.ps1`（批量构建工作流基线，HIGH）  
- `D:\chungbin\ycIDE-html\支持库源码\build-logs\last-run-summary.json`（全库 x64 构建结果样本，HIGH）  
- `D:\chungbin\ycIDE-html\版本更新说明.md`（v1.1 方向说明，HIGH）  
- 外部“典型生态模式”对照（离线环境下基于既有知识推断，LOW，后续建议在线核验）

---
*Feature research for: 第三方支持库编译契约标准化与自助构建*
*Researched: 2026-03-22*
