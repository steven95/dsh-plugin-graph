#!/usr/bin/env node
/**
 * dsh-plugin-graph CLI
 *
 * 零依赖命令行入口，供 CI / 手动检查使用。
 *
 * 用法：
 *   dsh-plugin-graph scan <dir> [--json]
 *   dsh-plugin-graph check <dir> [--json]
 *   dsh-plugin-graph preflight <existingDir> <incomingDir> [--json]
 *   dsh-plugin-graph compat <dir> <dshVersion> [--json]
 *
 * 退出码：0 = 健康 / 可安全安装；1 = 存在 error 级冲突或参数错误。
 */

import { scanDir } from '../lib/scanner.js'
import { buildGraph } from '../lib/graph.js'
import { detectConflicts } from '../lib/conflict.js'
import { renderReport, summarize } from '../lib/report.js'
import { checkCompat } from '../lib/compat.js'
import { preflight } from '../lib/preflight.js'

const [cmd, ...rest] = process.argv.slice(2)
const json = rest.includes('--json')
const args = rest.filter((a) => a !== '--json')

function analyze(plugins) {
  const graph = buildGraph(plugins)
  const conflicts = detectConflicts(plugins)
  return { graph, conflicts, summary: summarize(conflicts) }
}

function emit(obj) {
  if (json) console.log(JSON.stringify(obj, null, 2))
  else console.log(obj)
}

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function main() {
  switch (cmd) {
    case 'scan': {
      const dir = args[0]
      if (!dir) return fail('usage: dsh-plugin-graph scan <dir> [--json]')
      const { plugins, error } = scanDir(dir)
      if (error) return fail(error)
      const { graph, conflicts, summary } = analyze(plugins)
      if (json) return emit({ ok: summary.ok, plugins, ...summary, report: renderReport(graph, conflicts) })
      return emit(renderReport(graph, conflicts))
    }

    case 'check': {
      const dir = args[0]
      if (!dir) return fail('usage: dsh-plugin-graph check <dir> [--json]')
      const { plugins, error } = scanDir(dir)
      if (error) return fail(error)
      const { graph, conflicts, summary } = analyze(plugins)
      if (json) return emit({ ok: summary.ok, ...summary, report: renderReport(graph, conflicts) })
      return emit(renderReport(graph, conflicts))
    }

    case 'preflight': {
      const [existingDir, incomingDir] = args
      if (!existingDir || !incomingDir) {
        return fail('usage: dsh-plugin-graph preflight <existingDir> <incomingDir> [--json]')
      }
      const existing = scanDir(existingDir)
      if (existing.error) return fail(existing.error)
      const incoming = scanDir(incomingDir)
      if (incoming.error) return fail(incoming.error)
      const result = preflight(existing.plugins, incoming.plugins)
      if (json) return emit(result)
      return emit(renderPreflight(result))
    }

    case 'compat': {
      const [dir, dshVersion] = args
      if (!dir || !dshVersion) return fail('usage: dsh-plugin-graph compat <dir> <dshVersion> [--json]')
      const { plugins, error } = scanDir(dir)
      if (error) return fail(error)
      const results = checkCompat(plugins, dshVersion)
      if (json) return emit({ ok: results.every((r) => r.ok), results })
      return emit(renderCompat(results))
    }

    default:
      return fail('usage: dsh-plugin-graph <scan|check|preflight|compat> <dir> [--json]')
  }
}

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

function renderCompat(results) {
  const lines = []
  lines.push(`DSH 版本兼容性检查（${results.length} 个插件）`)
  for (const r of results) {
    lines.push(`  ${r.ok ? 'ok   ' : 'WARN '} ${r.plugin}@${r.version} requires ${r.requires} (current ${r.current})`)
  }
  return lines.join('\n')
}

main()
