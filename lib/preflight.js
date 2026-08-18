/**
 * dsh-plugin-graph - 安装预检
 *
 * 模拟"安装新插件"后的依赖图与冲突变化，输出增量报告。
 * 用于 `dsh plugin add` 前预检：冲突即拦截。
 */

import { buildGraph } from './graph.js'
import { detectConflicts } from './conflict.js'
import { summarize } from './report.js'

/**
 * 预检：合并现有插件与待安装插件，对比变更前后。
 * @param {object[]} existing 现有插件清单
 * @param {object[]} incoming 待安装插件清单
 * @returns {{
 *   incoming: string[], ok: boolean,
 *   before: object, after: object,
 *   newConflicts: object[], newMissing: object[], newCycles: string[][]
 * }}
 */
export function preflight(existing, incoming) {
  const before = analyze(normalize(existing))
  const after = analyze(normalize(existing.concat(incoming)))

  const newConflicts = after.conflicts.filter((c) => !containsIssue(before.conflicts, c))
  const newMissing = after.graph.missing.filter(
    (m) => !before.graph.missing.some((x) => x.plugin === m.plugin && x.service === m.service)
  )
  const newCycles = after.graph.cycles.filter(
    (c) => !before.graph.cycles.some((x) => x.join('|') === c.join('|'))
  )

  return {
    incoming: incoming.map((p) => p.name),
    before: { ...before.summary },
    after: { ...after.summary },
    newConflicts,
    newMissing,
    newCycles,
    ok: after.summary.ok && newConflicts.length === 0,
  }
}

function analyze(plugins) {
  const graph = buildGraph(plugins)
  const conflicts = detectConflicts(plugins)
  return { graph, conflicts, summary: summarize(conflicts) }
}

/** 归一化插件字段，补齐缺失数组，保证下游健壮性 */
function normalize(plugins) {
  return (plugins || []).map((p) => ({
    name: p.name || 'unknown',
    version: p.version || 'unknown',
    dshVersion: p.dshVersion || '*',
    inject: p.inject || [],
    provides: p.provides || [],
    tools: p.tools || [],
    events: p.events || [],
    intercepts: p.intercepts || [],
  }))
}

function containsIssue(list, issue) {
  return list.some(
    (x) =>
      x.type === issue.type &&
      x.subject === issue.subject &&
      x.plugins.join('|') === issue.plugins.join('|')
  )
}
