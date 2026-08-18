/**
 * dsh-plugin-graph - 版本兼容性检测
 *
 * 检测插件声明的 DSH 版本要求与当前运行版本的兼容性。
 * 版本要求来源：package.json 的 dsh.engines.dsh 或 peerDependencies["@deepseek-ai/dsh"]。
 * 支持范围：*、x.y.z、=x.y.z、^x.y.z、~x.y.z、>=x.y.z。
 */

/**
 * 解析版本号为结构化对象。
 * @param {string} v
 * @returns {{ major:number, minor:number, patch:number, pre?:string }|null}
 */
export function parseVersion(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] }
}

/**
 * 比较两个版本（parseVersion 结果）。返回负数/0/正数。
 */
export function compareVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  return 0
}

/**
 * 判断版本是否满足范围（简化 semver）。
 * @param {string} version 如 '0.1.0-rc.6'
 * @param {string} range 如 '^0.1.0'
 */
export function satisfies(version, range) {
  const v = parseVersion(version)
  if (!v) return false
  const r = String(range).trim()
  if (r === '*' || r === '' || r === 'latest') return true

  let m = r.match(/^\^(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const min = { major: +m[1], minor: +m[2], patch: +m[3] }
    if (compareVersions(v, min) < 0) return false
    if (min.major === 0) return v.major === 0 && v.minor === min.minor // ^0.x.y 仅允许 0.x.y
    return v.major === min.major
  }

  m = r.match(/^~(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const min = { major: +m[1], minor: +m[2], patch: +m[3] }
    if (compareVersions(v, min) < 0) return false
    return v.major === min.major && v.minor === min.minor
  }

  m = r.match(/^>=(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    return compareVersions(v, { major: +m[1], minor: +m[2], patch: +m[3] }) >= 0
  }

  m = r.match(/^(?:=)?(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    return compareVersions(v, { major: +m[1], minor: +m[2], patch: +m[3] }) === 0
  }

  return false
}

/**
 * 检查插件清单与当前 DSH 版本的兼容性。
 * @param {Array<{ name:string, version:string, dshVersion?:string }>} plugins
 * @param {string} currentDshVersion 当前 DSH 版本
 * @returns {Array<{ plugin:string, version:string, requires:string, current:string, ok:boolean, severity:string, message:string }>}
 */
export function checkCompat(plugins, currentDshVersion) {
  return plugins.map((p) => {
    const range = p.dshVersion || '*'
    const ok = satisfies(currentDshVersion, range)
    return {
      plugin: p.name,
      version: p.version,
      requires: range,
      current: currentDshVersion,
      ok,
      severity: ok ? 'info' : 'warning',
      message: ok
        ? `插件 ${p.name}@${p.version} 兼容 DSH ${currentDshVersion}`
        : `插件 ${p.name}@${p.version} 要求 DSH ${range}，当前 ${currentDshVersion} 不满足`,
    }
  })
}
