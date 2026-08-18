# dsh-plugin-graph

DSH（DeepSeek-Harness）生态级基建插件：**插件依赖图与冲突检测引擎**。

扫描已安装/待安装插件，静态解析元数据（不执行代码），构建插件依赖图，检测缺失依赖、循环依赖、工具/服务冲突、管道拦截重叠，并提供 **DSH 版本兼容性检查** 与 **安装预检**（冲突即拦截）。

## 特性

- **零侵入**：静态解析插件源码与 `package.json`，不执行插件代码，安全通用
- **四类冲突检测**：工具冲突（error）、服务冲突（error）、管道拦截重叠（warning）、事件监听重叠（info）
- **依赖图**：缺失依赖、循环依赖（DFS 三色标记）
- **版本兼容性**：核对插件声明的 DSH 版本要求与当前运行版本（简化 semver：`*` / `x.y.z` / `^` / `~` / `>=`）
- **安装预检**：模拟安装新插件后的增量风险，冲突即拦截
- **CLI / CI 就绪**：零依赖命令行入口，`--json` 机器可读输出，退出码 0/1 可直接接入 CI 门禁

## 安装

```bash
# 作为 DSH 插件安装
dsh plugin add dsh-plugin-graph

# 或作为 CLI 全局安装
npm install -g dsh-plugin-graph
```

## CLI 用法

```bash
# 扫描插件目录，构建依赖图并检测冲突
dsh-plugin-graph scan <dir> [--json]

# 冲突检查（无 error 级冲突即健康）
dsh-plugin-graph check <dir> [--json]

# 安装预检：模拟安装新插件后的增量风险
dsh-plugin-graph preflight <existingDir> <incomingDir> [--json]

# DSH 版本兼容性检查
dsh-plugin-graph compat <dir> <dshVersion> [--json]
```

退出码：`0` = 健康 / 可安全安装；`1` = 存在 error 级冲突或参数错误。

### CI 集成示例

```yaml
# .github/workflows/plugin-check.yml
- run: npm install -g dsh-plugin-graph
- run: dsh-plugin-graph check ./plugins --json
```

## 插件内工具

| 工具 | 说明 |
|---|---|
| `plugin_graph_scan` | 扫描插件目录，构建依赖图并检测冲突 |
| `plugin_graph_check` | 对给定插件清单做冲突检查 |
| `plugin_graph_preflight` | 安装预检：模拟安装新插件后的增量风险 |
| `plugin_graph_compat` | DSH 版本兼容性检查 |

## 检测维度

| 类型 | 严重级 | 说明 |
|---|---|---|
| `tool_conflict` | error | 两个插件注册同名工具 |
| `service_conflict` | error | 两个插件提供同名服务 |
| `missing_dependency` | error | 插件 inject 的服务无人提供 |
| `cycle_dependency` | error | 插件间存在循环依赖 |
| `interceptor_overlap` | warning | 多个插件拦截同一工具管道 |
| `event_overlap` | info | 多个插件监听同一事件 |

## 开发

```bash
# 冒烟测试（不依赖 DSH 运行时）
node temp/plugin-graph-smoke.mjs
node temp/plugin-graph-smoke2.mjs
```

业务逻辑全部为纯函数（`lib/*.js`），可独立测试；运行时（`index.js`）只做薄封装。

## License

MIT
