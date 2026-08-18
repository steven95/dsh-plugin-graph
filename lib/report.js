/**
 * dsh-plugin-graph - 报告渲染
 *
 * 输出：ASCII 依赖图 + 冲突清单 + 修复建议。
 */

/**
 * 渲染 ASCII 依赖图。
 * @param {object} graph buildGraph 的返回
 */
export function renderGraphAscii(graph) {
  const lines = []
  lines.push(`插件依赖图（${graph.nodes.length} 节点 / ${graph.edges.length} 边）`)
  if (graph.edges.length === 0) {
    lines.push('  （无依赖边）')
  }
  for (const e of graph.edges) {
    lines.push(`  ${e.from} --[${e.service}]--> ${e.to}`)
  }
  return lines.join('\n')
}

/**
 * 渲染完整报告。
 * @param {object} graph
 * @param {object[]} conflicts
 */
export function renderReport(graph, conflicts) {
  const lines = []
  lines.push(renderGraphAscii(graph))

  if (graph.missing.length) {
    lines.push('')
    lines.push(`[缺失依赖] ${graph.missing.length} 处`)
    for (const m of graph.missing) {
      lines.push(`  - ${m.plugin} 依赖服务 "${m.service}"，但无插件提供`)
    }
  }
  if (graph.cycles.length) {
    lines.push('')
    lines.push(`[循环依赖] ${graph.cycles.length} 处`)
    for (const c of graph.cycles) {
      lines.push(`  - ${c.join(' -> ')}`)
    }
  }
  if (graph.isolated.length) {
    lines.push('')
    lines.push(`[孤立插件] ${graph.isolated.length} 个（无依赖、无服务）`)
    for (const id of graph.isolated) lines.push(`  - ${id}`)
  }

  const bySeverity = { error: [], warning: [], info: [] }
  for (const c of conflicts) bySeverity[c.severity].push(c)
  for (const sev of ['error', 'warning', 'info']) {
    if (bySeverity[sev].length) {
      lines.push('')
      lines.push(`[${sev.toUpperCase()}] ${bySeverity[sev].length} 项`)
      for (const c of bySeverity[sev]) {
        lines.push(`  - [${c.type}] ${c.message}`)
      }
    }
  }

  const tips = []
  if (bySeverity.error.length) tips.push('存在 error 级冲突，建议卸载或替换冲突插件之一')
  if (graph.missing.length) tips.push('存在缺失依赖，安装提供对应服务的插件')
  if (graph.cycles.length) tips.push('存在循环依赖，检查插件间服务引用是否可解耦')
  if (bySeverity.warning.length) tips.push('多个插件拦截工具管道，注意执行顺序与放行逻辑')
  if (tips.length) {
    lines.push('')
    lines.push('[建议]')
    for (const t of tips) lines.push(`  - ${t}`)
  }

  return lines.join('\n')
}

/**
 * 冲突摘要。
 * @param {object[]} conflicts
 * @returns {{ ok:boolean, error:number, warning:number, info:number }}
 */
export function summarize(conflicts) {
  const count = { error: 0, warning: 0, info: 0 }
  for (const c of conflicts) count[c.severity]++
  return { ok: count.error === 0, ...count }
}
