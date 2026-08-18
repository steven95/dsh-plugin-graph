/**
 * dsh-plugin-graph - 插件冲突检测
 *
 * 检测维度：
 *  - tool_conflict        两个插件注册同名工具（error）
 *  - service_conflict     两个插件提供同名服务（error）
 *  - interceptor_overlap  多个插件拦截同一工具管道（warning）
 *  - event_overlap        多个插件监听同一事件（info）
 */

/**
 * 检测插件间冲突。
 * @param {Array<{ name:string, tools:string[], provides:string[], events:string[], intercepts:string[] }>} plugins
 * @returns {Array<{ severity:'error'|'warning'|'info', type:string, subject:string, plugins:string[], message:string }>}
 */
export function detectConflicts(plugins) {
  const issues = []

  // 工具名冲突（error）
  const toolMap = new Map()
  for (const p of plugins) {
    for (const t of p.tools) {
      if (toolMap.has(t)) {
        issues.push({
          severity: 'error',
          type: 'tool_conflict',
          subject: t,
          plugins: [toolMap.get(t), p.name],
          message: `工具 "${t}" 被多个插件注册：${toolMap.get(t)} 与 ${p.name}`,
        })
      } else {
        toolMap.set(t, p.name)
      }
    }
  }

  // 服务冲突（error）
  const svcMap = new Map()
  for (const p of plugins) {
    for (const s of p.provides) {
      if (svcMap.has(s)) {
        issues.push({
          severity: 'error',
          type: 'service_conflict',
          subject: s,
          plugins: [svcMap.get(s), p.name],
          message: `服务 "${s}" 被多个插件提供：${svcMap.get(s)} 与 ${p.name}`,
        })
      } else {
        svcMap.set(s, p.name)
      }
    }
  }

  // 工具管道拦截重叠（warning）
  const interceptors = plugins.filter((p) => p.intercepts.length > 0)
  if (interceptors.length > 1) {
    issues.push({
      severity: 'warning',
      type: 'interceptor_overlap',
      subject: 'tools/pre-execute',
      plugins: interceptors.map((p) => p.name),
      message: `多个插件拦截工具管道：${interceptors.map((p) => p.name).join(', ')}，执行顺序可能互相影响`,
    })
  }

  // 事件监听重叠（info）
  const evtMap = new Map()
  for (const p of plugins) {
    for (const e of p.events) {
      if (!evtMap.has(e)) evtMap.set(e, [])
      evtMap.get(e).push(p.name)
    }
  }
  for (const [evt, list] of evtMap) {
    if (list.length > 1) {
      issues.push({
        severity: 'info',
        type: 'event_overlap',
        subject: evt,
        plugins: list,
        message: `事件 "${evt}" 被 ${list.length} 个插件监听：${list.join(', ')}`,
      })
    }
  }

  return issues
}
