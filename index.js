/**
 * dsh-plugin-graph - 插件依赖图与冲突检测引擎
 *
 * 生态级基建：扫描已安装/待安装插件，构建依赖图，
 * 检测缺失依赖、循环依赖、工具/服务冲突、管道拦截重叠。
 *
 * 独立插件，不依赖任何基座，纯函数逻辑在 lib/ 下可独立测试。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { scanDir } from './lib/scanner.js'
import { buildGraph } from './lib/graph.js'
import { detectConflicts } from './lib/conflict.js'
import { renderReport, summarize } from './lib/report.js'
import { checkCompat } from './lib/compat.js'
import { preflight } from './lib/preflight.js'

export const name = 'dsh-plugin-graph'

export function apply(ctx) {
  const api = {
    /**
     * 扫描插件目录，解析每个子目录的元数据。
     * @param {string} dir 插件源码目录
     */
    scan(dir) {
      return scanDir(dir)
    },

    /**
     * 分析插件清单：构建依赖图 + 冲突检测。
     * @param {object[]} plugins
     */
    analyze(plugins) {
      const graph = buildGraph(plugins)
      const conflicts = detectConflicts(plugins)
      return { graph, conflicts, summary: summarize(conflicts) }
    },

    /**
     * 版本兼容性检查。
     * @param {object[]} plugins
     * @param {string} dshVersion 当前 DSH 版本
     */
    compat(plugins, dshVersion) {
      return checkCompat(plugins, dshVersion)
    },

    /**
     * 安装预检：模拟安装新插件后的增量风险。
     * @param {object[]} existing 现有插件
     * @param {object[]} incoming 待安装插件
     */
    preflight(existing, incoming) {
      return preflight(existing, incoming)
    },
  }

  // ---------- 工具注册 ----------

  ctx.tools.register(defineTool({
    name: 'plugin_graph_scan',
    description: '扫描插件目录，构建插件依赖图并检测冲突（缺失依赖/循环依赖/工具冲突/服务冲突/管道拦截重叠）。',
    parameters: {
      dir: { type: 'string', required: true, description: '插件源码目录绝对路径' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.report || JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const { plugins, error } = api.scan(args.dir)
      if (error) return { ok: false, error }
      const { graph, conflicts, summary } = api.analyze(plugins)
      return { ok: true, ...summary, report: renderReport(graph, conflicts) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plugin_graph_check',
    description: '对给定插件清单做冲突检查，返回是否健康（无 error 级冲突）及完整报告。',
    parameters: {
      plugins: { type: 'array', required: true, description: '插件元数据数组（name/inject/provides/tools/events）' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.report || JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const { graph, conflicts, summary } = api.analyze(args.plugins || [])
      return { ok: summary.ok, ...summary, report: renderReport(graph, conflicts) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plugin_graph_preflight',
    description: '安装预检：模拟安装新插件后的增量风险（新增冲突/缺失依赖/循环依赖），冲突即拦截。',
    parameters: {
      existingDir: { type: 'string', required: true, description: '现有插件目录绝对路径' },
      incomingDir: { type: 'string', required: true, description: '待安装插件目录绝对路径' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.report || JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const existing = api.scan(args.existingDir)
      if (existing.error) return { ok: false, error: existing.error }
      const incoming = api.scan(args.incomingDir)
      if (incoming.error) return { ok: false, error: incoming.error }
      const result = api.preflight(existing.plugins, incoming.plugins)
      return { ok: result.ok, ...result, report: renderPreflight(result) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'plugin_graph_compat',
    description: 'DSH 版本兼容性检查：核对每个插件声明的 DSH 版本要求与当前运行版本是否匹配。',
    parameters: {
      dir: { type: 'string', required: true, description: '插件源码目录绝对路径' },
      dshVersion: { type: 'string', required: true, description: '当前 DSH 版本号，如 0.1.0' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: value.report || JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const { plugins, error } = api.scan(args.dir)
      if (error) return { ok: false, error }
      const results = api.compat(plugins, args.dshVersion)
      const ok = results.every((r) => r.ok)
      return { ok, results, report: renderCompat(results) }
    },
  }))

  // ---------- UI 面板（可选） ----------
  if (ctx.ui && typeof ctx.ui.registerPanel === 'function') {
    ctx.ui.registerPanel('plugin-graph', {
      title: 'Plugin Graph',
      description: '插件依赖图与冲突检测',
      commands: ['plugin graph', 'plugin check'],
    })
  }

  return api
}

/** 渲染安装预检报告（文本） */
function renderPreflight(result) {
  const lines = []
  lines.push(`安装预检：${result.incoming.join(', ')}`)
  lines.push(`  变更前: error=${result.before.error} warning=${result.before.warning}`)
  lines.push(`  变更后: error=${result.after.error} warning=${result.after.warning}`)
  if (result.newConflicts.length) {
    lines.push(`  [新增冲突] ${result.newConflicts.length} 项`)
    for (const c of result.newConflicts) lines.push(`    - [${c.type}] ${c.message}`)
  }
  if (result.newMissing.length) {
    lines.push(`  [新增缺失依赖] ${result.newMissing.length} 项`)
    for (const m of result.newMissing) lines.push(`    - ${m.plugin} 依赖 ${m.service}`)
  }
  if (result.newCycles.length) {
    lines.push(`  [新增循环依赖] ${result.newCycles.length} 项`)
    for (const c of result.newCycles) lines.push(`    - ${c.join(' -> ')}`)
  }
  lines.push(result.ok ? '  结论: 可安全安装' : '  结论: 存在风险，建议修复后安装')
  return lines.join('\n')
}

/** 渲染版本兼容性报告（文本） */
function renderCompat(results) {
  const lines = []
  lines.push(`DSH 版本兼容性检查（${results.length} 个插件）`)
  for (const r of results) {
    lines.push(`  ${r.ok ? 'ok   ' : 'WARN '} ${r.plugin}@${r.version} requires ${r.requires} (current ${r.current})`)
  }
  return lines.join('\n')
}
