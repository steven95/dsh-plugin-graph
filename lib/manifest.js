/**
 * dsh-plugin-graph - 插件清单静态解析
 *
 * 从插件源码（ESM）静态提取元数据，不执行代码（安全、通用）：
 *  - name / version
 *  - inject      依赖的服务（export const inject = [...]）
 *  - provides    提供的服务（ctx.provide / service.register）
 *  - tools       注册的工具名（ctx.tools.register(defineTool({name}))）
 *  - events      监听的事件（ctx.on）
 *  - intercepts  工具管道拦截（tools/pre-execute 等）
 */

const RE_NAME = /export\s+const\s+name\s*=\s*['"]([^'"]+)['"]/
const RE_INJECT = /export\s+const\s+inject\s*=\s*\[([^\]]*)\]/
const RE_PROVIDE = /(?:ctx\.provide|service\.register|ctx\.service\.provide)\(\s*['"]([^'"]+)['"]/g
const RE_TOOL_BLOCK = /ctx\.tools\.register\s*\(\s*defineTool\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\)/g
const RE_EVENT = /ctx\.on\s*\(\s*['"]([^'"]+)['"]/g

/** 工具管道事件（拦截类） */
export const PIPE_EVENTS = [
  'tools/pre-execute',
  'tools/post-execute',
  'tools/execute',
  'session/event',
]

/**
 * 解析插件源码，提取元数据。
 * @param {string} source 插件源码文本
 * @param {{ name?: string, version?: string, dshVersion?: string }} opts 外部补充信息
 * @returns {{
 *   name: string, version: string, dshVersion: string,
 *   inject: string[], provides: string[], tools: string[],
 *   events: string[], intercepts: string[]
 * }}
 */
export function parsePluginSource(source, { name, version, dshVersion } = {}) {
  const events = extractAll(RE_EVENT, source)
  return {
    name: name || extract(RE_NAME, source) || 'unknown',
    version: version || 'unknown',
    dshVersion: dshVersion || '*',
    inject: extractList(RE_INJECT, source),
    provides: extractAll(RE_PROVIDE, source),
    tools: extractTools(source),
    events,
    intercepts: events.filter((e) => PIPE_EVENTS.includes(e)),
  }
}

/**
 * 解析 package.json，提取 DSH 版本要求。
 * 优先级：dsh.engines.dsh > peerDependencies["@deepseek-ai/dsh"] > '*'
 * @param {object} pkg package.json 内容
 * @returns {{ name: string, version: string, dshVersion: string }}
 */
export function parsePackageJson(pkg) {
  const dsh = pkg.dsh || {}
  const peer = pkg.peerDependencies || {}
  return {
    name: pkg.name || 'unknown',
    version: pkg.version || 'unknown',
    dshVersion: (dsh.engines && dsh.engines.dsh) || peer['@deepseek-ai/dsh'] || '*',
  }
}

function extract(re, source) {
  const m = source.match(re)
  return m ? m[1] : undefined
}

function extractAll(re, source) {
  return [...source.matchAll(re)].map((m) => m[1])
}

function extractList(re, source) {
  const m = source.match(re)
  if (!m) return []
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
}

function extractTools(source) {
  const tools = []
  for (const m of source.matchAll(RE_TOOL_BLOCK)) {
    const nameM = m[1].match(/name\s*:\s*['"]([^'"]+)['"]/)
    if (nameM) tools.push(nameM[1])
  }
  return tools
}
