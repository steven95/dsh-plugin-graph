/**
 * dsh-plugin-graph - 插件依赖图
 *
 * 节点 = 插件；边 = inject 依赖（A 依赖 B 提供的服务）。
 * 检测：缺失依赖、循环依赖、孤立节点。
 */

/**
 * 构建插件依赖图。
 * @param {Array<{ name:string, inject:string[], provides:string[] }>} plugins
 * @returns {{
 *   nodes: object[], edges: Array<{from,to,service}>,
 *   missing: Array<{plugin,service}>, cycles: string[][], isolated: string[]
 * }}
 */
export function buildGraph(plugins) {
  const nodes = plugins.map((p) => ({ id: p.name, ...p }))

  // 服务 -> 提供者 索引
  const providerMap = new Map()
  for (const p of plugins) {
    for (const svc of p.provides) {
      if (!providerMap.has(svc)) providerMap.set(svc, [])
      providerMap.get(svc).push(p.name)
    }
  }

  const edges = []
  const missing = []
  for (const p of plugins) {
    for (const dep of p.inject) {
      const providers = providerMap.get(dep) || []
      if (providers.length === 0) {
        missing.push({ plugin: p.name, service: dep })
      } else {
        for (const provider of providers) {
          edges.push({ from: p.name, to: provider, service: dep })
        }
      }
    }
  }

  const cycles = detectCycles(plugins.map((p) => p.name), edges)
  const isolated = plugins
    .filter((p) => {
      const hasEdge = edges.some((e) => e.from === p.name || e.to === p.name)
      return !hasEdge && p.inject.length === 0 && p.provides.length === 0
    })
    .map((p) => p.name)

  return { nodes, edges, missing, cycles, isolated }
}

/**
 * 有向图环检测（DFS 三色标记）。
 * @param {string[]} nodeIds
 * @param {Array<{from:string,to:string}>} edges
 * @returns {string[][]} 环路径列表
 */
export function detectCycles(nodeIds, edges) {
  const adj = new Map()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) {
    if (adj.has(e.from)) adj.get(e.from).push(e.to)
  }

  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map()
  for (const id of nodeIds) color.set(id, WHITE)

  const stack = []
  const cycles = []

  function dfs(u) {
    color.set(u, GRAY)
    stack.push(u)
    for (const v of adj.get(u) || []) {
      if (color.get(v) === GRAY) {
        const idx = stack.indexOf(v)
        cycles.push(stack.slice(idx).concat(v))
      } else if (color.get(v) === WHITE) {
        dfs(v)
      }
    }
    stack.pop()
    color.set(u, BLACK)
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE) dfs(id)
  }
  return cycles
}
