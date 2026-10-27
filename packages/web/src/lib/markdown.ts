import type { Root, Parent, PhrasingContent, Blockquote, Paragraph, Text } from 'mdast'

// ── Frontmatter YAML (subconjunto simple: "clave: valor" y listas "- item") ──

export type Frontmatter = Record<string, string | string[]>

export function parseFrontmatter(source: string): { data: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(source)
  if (!match) return { data: {}, body: source }

  const data: Frontmatter = {}
  let currentKey: string | null = null

  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim() || line.trim().startsWith('#')) continue

    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && currentKey) {
      const prev = data[currentKey]
      const list = Array.isArray(prev) ? prev : prev ? [prev] : []
      list.push(unquote(item[1]))
      data[currentKey] = list
      continue
    }

    const pair = /^([^:\s][^:]*):\s*(.*)$/.exec(line)
    if (pair) {
      currentKey = pair[1].trim()
      const value = pair[2].trim()
      if (value.startsWith('[') && value.endsWith(']')) {
        data[currentKey] = value.slice(1, -1).split(',').map(v => unquote(v.trim())).filter(Boolean)
      } else {
        data[currentKey] = unquote(value)
      }
    }
  }

  return { data, body: source.slice(match[0].length) }
}

function unquote(value: string) {
  return value.replace(/^(['"])(.*)\1$/, '$2')
}

// ── Utilidades ────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** Normaliza un título para comparar wikilinks: "carpeta/Nota.md" → "nota" */
export function normalizeTitle(title: string): string {
  const base = title.split('/').pop() ?? title
  return base.replace(/\.md$/i, '').trim().toLowerCase()
}

export const WIKI_PREFIX = '#wiki:'

/** href interno de un wikilink: "#wiki:<página>" o "#wiki:<página>::<encabezado>" */
export function parseWikiHref(href: string): { page: string; heading: string | null } | null {
  if (!href.startsWith(WIKI_PREFIX)) return null
  const [page, heading] = href.slice(WIKI_PREFIX.length).split('::')
  return { page: decodeURIComponent(page), heading: heading ? decodeURIComponent(heading) : null }
}

// ── Plugin remark: callouts y wikilinks de Obsidian ─────────────────────────

const WIKILINK_RE = /(!?)\[\[([^\]\n]+?)\]\]/g
const CALLOUT_RE = /^\[!([\w-]+)\]([+-]?)[ \t]*/
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

export function remarkObsidian() {
  return (tree: Root) => {
    walk(tree)
  }
}

function walk(node: Parent) {
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]

    if (child.type === 'text') {
      const replacement = splitWikiLinks(child)
      if (replacement) {
        node.children.splice(i, 1, ...(replacement as typeof node.children))
        i += replacement.length - 1
      }
      continue
    }

    if (child.type === 'link' || child.type === 'code' || child.type === 'inlineCode') continue
    if (child.type === 'blockquote') transformCallout(child)
    if ('children' in child) walk(child as Parent)
  }
}

function splitWikiLinks(node: Text): PhrasingContent[] | null {
  const value = node.value
  WIKILINK_RE.lastIndex = 0
  if (!WIKILINK_RE.test(value)) return null
  WIKILINK_RE.lastIndex = 0

  const out: PhrasingContent[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = WIKILINK_RE.exec(value))) {
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) })
    last = m.index + m[0].length

    const [target, alias] = m[2].split('|')
    const [page, heading] = target.split('#')
    const pageName = page.trim()
    const headingName = heading?.trim() || null

    if (m[1] && IMAGE_EXT_RE.test(pageName)) {
      // Embeds de imágenes locales del vault: no existen en la web
      out.push({ type: 'inlineCode', value: `imagen: ${pageName}` })
      continue
    }

    const label = alias?.trim() || (headingName ? (pageName ? `${pageName} › ${headingName}` : headingName) : pageName)
    const url = pageName
      ? `${WIKI_PREFIX}${encodeURIComponent(pageName)}${headingName ? `::${encodeURIComponent(headingName)}` : ''}`
      : `#${slugify(headingName ?? '')}`

    out.push({ type: 'link', url, children: [{ type: 'text', value: label }] })
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) })
  return out
}

function transformCallout(node: Blockquote) {
  const first = node.children[0]
  if (!first || first.type !== 'paragraph') return
  const firstText = first.children[0]
  if (!firstText || firstText.type !== 'text') return

  const m = CALLOUT_RE.exec(firstText.value)
  if (!m) return

  const type = m[1].toLowerCase()
  firstText.value = firstText.value.slice(m[0].length)

  // El título es todo lo que hay hasta el primer salto de línea del párrafo
  const titleChildren: PhrasingContent[] = []
  while (first.children.length > 0) {
    const current = first.children[0]
    if (current.type === 'text' && current.value.includes('\n')) {
      const nl = current.value.indexOf('\n')
      const before = current.value.slice(0, nl)
      if (before) titleChildren.push({ type: 'text', value: before })
      current.value = current.value.slice(nl + 1)
      if (!current.value) first.children.shift()
      break
    }
    if (current.type === 'break') {
      first.children.shift()
      break
    }
    titleChildren.push(current)
    first.children.shift()
  }

  const hasTitle = titleChildren.some(c => c.type !== 'text' || c.value.trim())
  const titleNode: Paragraph = {
    type: 'paragraph',
    data: { hName: 'div', hProperties: { className: ['callout-title'], dataCallout: type } },
    children: hasTitle ? titleChildren : [{ type: 'text', value: type.charAt(0).toUpperCase() + type.slice(1) }],
  }

  if (first.children.length === 0) node.children.shift()
  node.children.unshift(titleNode)
  node.data = { hName: 'div', hProperties: { className: ['callout'], dataCallout: type } }
}
