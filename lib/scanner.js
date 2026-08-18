/**
 * dsh-plugin-graph - 插件目录扫描
 *
 * 扫描目录下每个子目录，读取 index.js 源码与 package.json，
 * 解析为插件元数据。不依赖 DSH 运行时，CLI 与插件本体共用。
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parsePluginSource, parsePackageJson } from './manifest.js'

/**
 * 扫描插件目录。
 * 支持两种结构：
 *  1. 目录本身即一个插件（目录下直接有 index.js）
 *  2. 目录下每个子目录是一个插件
 * @param {string} dir 插件源码目录
 * @returns {{ plugins: object[], error?: string }}
 */
export function scanDir(dir) {
  if (!dir || !existsSync(dir)) return { plugins: [], error: `directory not found: ${dir}` }
  const plugins = []

  // 情况 1：目录本身即一个插件
  const selfSrc = join(dir, 'index.js')
  if (existsSync(selfSrc)) {
    plugins.push(parsePlugin(dir, selfSrc))
    return { plugins }
  }

  // 情况 2：目录下每个子目录是一个插件
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const srcPath = join(dir, entry.name, 'index.js')
    if (!existsSync(srcPath)) continue
    plugins.push(parsePlugin(join(dir, entry.name), srcPath, entry.name))
  }
  return { plugins }
}

/** 解析单个插件目录（index.js + package.json） */
function parsePlugin(dir, srcPath, fallbackName) {
  let pkgMeta = {}
  try {
    pkgMeta = parsePackageJson(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')))
  } catch {
    /* 无 package.json 时使用默认值 */
  }
  const source = readFileSync(srcPath, 'utf8')
  return parsePluginSource(source, {
    name: fallbackName || pkgMeta.name,
    version: pkgMeta.version,
    dshVersion: pkgMeta.dshVersion,
  })
}
