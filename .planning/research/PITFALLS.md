# Domain Pitfalls

**Domain:** 易语言支持库迁移（GBK→UTF-8 + x86→x64）
**Researched:** 2026-03-21
**Confidence:** MEDIUM（主要基于仓库上下文与通用迁移经验；缺少外部官方资料在线核验）

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: “看起来能编译”但字符串已静默损坏（Mojibake）
**What goes wrong:**  
源码/资源从 GBK 转 UTF-8 后能通过编译，但运行时中文显示乱码、比较失败、路径匹配失败（尤其是库名、命令名、错误消息、配置键）。

**Why it happens:**  
- 把“文件编码转换”当成“字符语义转换”，没有做 round-trip 校验  
- 混用 `char*` / `wchar_t*` 边界，默认代码页行为不一致  
- 某些文件含 BOM、某些不含，加载器逻辑不统一  

**Consequences:**  
- 支持库元数据解析错误（命令名/参数名损坏）  
- 运行时行为偏差但不一定崩溃，排查成本极高  

**Warning signs (early):**  
- 同一库在 IDE 列表中名称偶发“口口口/??/锟斤拷”  
- 字符串长度异常（字节数正确但字符数不对）  
- 仅在某些机器/系统区域设置下复现问题  

**Prevention:**  
- 建立“编码哨兵样本”回归集（简繁中文、全角符号、emoji、混合路径）  
- 统一转换策略：明确哪些文件必须 UTF-8 with/without BOM，并在 CI 检查  
- 对关键文本资产做 round-trip 测试（GBK→UTF-8→GBK 或语义等价比较）  
- 在边界层统一使用显式转换 API（禁止依赖系统默认代码页）

**Detection:**  
- 引入自动扫描：检测非法 UTF-8 序列、替换字符 `�`、可疑字节模式  
- 启用“严格解码失败即报错”而非 fallback 成空字符串

**Phase to address:**  
Phase 1（资产清点与基线）+ Phase 2（编码转换流水线）

---

### Pitfall 2: 指针截断（x64）导致随机崩溃/脏数据
**What goes wrong:**  
把指针、句柄或 size 仍存入 `int/long`，x86 下可运行，x64 下出现随机访问冲突、数据错位、偶发崩溃。

**Why it happens:**  
- 历史代码默认 32 位数据模型  
- FFI/结构体定义仍按 x86 假设写死字段宽度  

**Consequences:**  
- 难复现崩溃（和输入、地址布局有关）  
- 解析器读取到“看似合法但错误”的元数据，后续链路全错

**Warning signs (early):**  
- 编译器出现 `cast from pointer to smaller type` / size 警告  
- 仅 x64 构建失败或仅 x64 运行崩溃  
- 大数据/长时间运行时问题显著增加

**Prevention:**  
- 全面替换为指针安全类型：`intptr_t`/`uintptr_t`/`size_t`/`SSIZE_T`  
- 审计所有句柄/地址转换点（特别是序列化、IPC、FFI 边界）  
- 把“0 warning for truncation”设为发布门禁

**Detection:**  
- 在迁移期启用最高等级告警与静态检查  
- 增加 x64-only 压测样例（大对象、高地址空间分配）

**Phase to address:**  
Phase 3（x64 ABI 与类型迁移）

---

### Pitfall 3: ABI/调用约定假设错误（尤其 FFI 边界）
**What goes wrong:**  
函数能“调用成功”但参数解释错位、返回值异常或栈破坏；结构体对齐/packing 不一致，导致解析结果错误。

**Why it happens:**  
- x86 到 x64 时调用约定变化被忽略（历史 `__stdcall`/`__cdecl` 约定遗留）  
- 结构体 `#pragma pack`、字段顺序、对齐规则未与真实二进制契约一致  

**Consequences:**  
- `fne` 元数据读取错乱（命令签名、GUID、字段长度错误）  
- 问题被 catch 吃掉后呈现为空结果，误判为“库本身无数据”

**Warning signs (early):**  
- 同一 DLL 在不同机器解析结果不一致  
- 结构体字段值出现明显不可能值（超大长度、负索引）  
- 日志显示“成功加载”，但命令数量异常偏少/为 0

**Prevention:**  
- 为每个 FFI 入口建立“二进制契约测试”（golden fixtures）  
- 固定并文档化 packing/对齐策略；禁止隐式默认  
- 对解析结果加 schema invariants（长度范围、必填字段、GUID 格式）

**Detection:**  
- 在解析层加入 strict mode：任一关键字段异常立即 fail-fast  
- 收集并比对 x86/x64 解析差异报告

**Phase to address:**  
Phase 3（x64 ABI 与类型迁移）+ Phase 4（集成验证）

---

### Pitfall 4: 依赖链里混入 x86-only 二进制，最终发布才暴雷
**What goes wrong:**  
主库完成 x64 改造，但间接依赖仍为 x86（含第三方 DLL/静态库/插件），到联调或用户机才出现“无法加载模块”。

**Why it happens:**  
- 只迁移了“可见主工程”，未做依赖清单与架构审计  
- 构建脚本未在产物层验证 PE 机器类型

**Consequences:**  
- 集成阶段大面积回滚、返工  
- 发布窗口被阻塞

**Warning signs (early):**  
- CI/本地日志出现 `BadImageFormat`、`%1 不是有效的 Win32 应用程序`  
- 仅在调用某特定功能时崩溃（延迟加载到该依赖）

**Prevention:**  
- 建立“依赖 SBOM + 架构清单”（每个二进制标注 x86/x64）  
- 在打包前自动校验所有 PE 文件机器类型与目标一致  
- 对不可迁移依赖制定替换/隔离方案（进程外桥接）

**Detection:**  
- 增加“最小功能集端到端冒烟”，覆盖所有延迟加载路径  
- 构建产物审计失败即阻断发布

**Phase to address:**  
Phase 1（资产清点）+ Phase 4（集成与打包）

---

### Pitfall 5: 静默异常处理掩盖迁移缺陷，导致“假成功”
**What goes wrong:**  
解析/加载失败被 `catch {}` 吞掉，系统继续运行但数据不完整；团队误以为迁移成功。

**Why it happens:**  
- 为兼容历史脏数据而放宽错误处理  
- 缺乏可观测性与错误分级

**Consequences:**  
- 缺陷进入后续阶段放大，最终定位困难  
- roadmap 估算失真（以为完成度高，实际技术债累积）

**Warning signs (early):**  
- “成功日志”很多，但结果集经常为空/偏少  
- 用户反馈功能缺失，日志却无明确错误  
- 同一输入重复运行结果波动

**Prevention:**  
- 迁移阶段改为 fail-fast：关键路径禁止 silent catch  
- 建立错误码与诊断输出规范（文件、编码、ABI、依赖分类）  
- 将“解析完整度指标”纳入验收（命令数、类型数、关键字段覆盖率）

**Detection:**  
- 强制输出迁移报告（成功/失败/降级处理项）  
- 对“空结果”设异常阈值告警

**Phase to address:**  
Phase 2（编码转换）+ Phase 3（ABI 迁移）+ Phase 5（回归与质量闸门）

## Moderate Pitfalls

### Pitfall 1: 把批量转换当一次性脚本，不做可重复流水线
**What goes wrong:** 一次性转换后无法稳定复现，后续补库/修复时再次引入编码漂移。  
**Warning signs:** 不同开发者转换结果 diff 大量波动。  
**Prevention:** 固化脚本、版本化规则、在 CI 中重复执行并比较产物哈希。  
**Phase to address:** Phase 2

### Pitfall 2: 测试只覆盖“启动成功”，不覆盖关键迁移语义
**What goes wrong:** UI 冒烟通过，但库加载、命令解析、编译输出已偏离。  
**Warning signs:** 只有启动测试，无 parser/compiler 针对性用例。  
**Prevention:** 增加金样例回归：库扫描→加载→命令元数据→编译最小程序→运行断言。  
**Phase to address:** Phase 5

## Minor Pitfalls

### Pitfall 1: BOM 策略不统一导致工具链边缘行为不一致
**What goes wrong:** 某些工具把 UTF-8 BOM 视作内容，首字段多出不可见字符。  
**Warning signs:** 首字段匹配失败但肉眼看正常。  
**Prevention:** 明确并自动检查 BOM 策略，导入时剥离/规范化。  
**Phase to address:** Phase 2

### Pitfall 2: 日志只记录“失败”，不记录输入上下文
**What goes wrong:** 失败后无法定位是哪个库、哪个符号、哪种编码触发。  
**Warning signs:** 错误信息泛化为“parse failed”。  
**Prevention:** 日志最小字段标准化：库路径、哈希、编码判定、ABI 模式、异常栈。  
**Phase to address:** Phase 5

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: 资产清点与基线 | 漏盘点间接依赖，后期出现 x86-only 阻断 | 建 SBOM + 架构清单，先做依赖可迁移性评审 |
| Phase 2: 编码转换流水线 | 静默乱码/双重转码 | 编码哨兵集 + round-trip + 非法 UTF-8 扫描 |
| Phase 3: x64 ABI 迁移 | 指针截断、结构体对齐错误 | 指针安全类型替换 + ABI 契约测试 + strict parser |
| Phase 4: 集成与打包 | 构建通过但运行加载失败 | PE 架构自动审计 + 延迟加载路径冒烟 |
| Phase 5: 回归与质量闸门 | “假成功”上线（错误被吞） | fail-fast、完整度指标、发布前阻断规则 |

## Sources

- Internal project context:  
  - `D:\chungbin\ycIDE-html\.planning\PROJECT.md`（迁移目标与范围）  
  - `D:\chungbin\ycIDE-html\.planning\codebase\CONCERNS.md`（silent catch、FFI 脆弱区、测试缺口）  
  - `D:\chungbin\ycIDE-html\.planning\codebase\TESTING.md`（当前测试主要为启动冒烟）  
- Industry migration practices for encoding/ABI transitions（未在线核验，LOW confidence）

