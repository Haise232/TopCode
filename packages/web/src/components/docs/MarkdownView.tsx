import { memo, useMemo, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Element, ElementContent } from 'hast'
import {
  AlertTriangle, Bug, CheckCircle2, ClipboardList, Flame, HelpCircle, Info,
  Lightbulb, ListChecks, Pencil, Quote, XCircle, FileText, Tag,
} from 'lucide-react'
import { parseFrontmatter, parseWikiHref, remarkObsidian, slugify, normalizeTitle } from '../../lib/markdown'
import { cn } from '../ui/cn'

const CALLOUTS: Record<string, { Icon: React.ElementType; color: string }> = {
  note:      { Icon: Pencil,        color: '#60a5fa' },
  abstract:  { Icon: ClipboardList, color: '#2dd4bf' },
  summary:   { Icon: ClipboardList, color: '#2dd4bf' },
  tldr:      { Icon: ClipboardList, color: '#2dd4bf' },
  info:      { Icon: Info,          color: '#60a5fa' },
  todo:      { Icon: ListChecks,    color: '#60a5fa' },
  tip:       { Icon: Lightbulb,     color: '#34d399' },
  hint:      { Icon: Lightbulb,     color: '#34d399' },
  important: { Icon: Flame,         color: '#34d399' },
  success:   { Icon: CheckCircle2,  color: '#4ade80' },
  check:     { Icon: CheckCircle2,  color: '#4ade80' },
  done:      { Icon: CheckCircle2,  color: '#4ade80' },
  question:  { Icon: HelpCircle,    color: '#fbbf24' },
  help:      { Icon: HelpCircle,    color: '#fbbf24' },
  faq:       { Icon: HelpCircle,    color: '#fbbf24' },
  warning:   { Icon: AlertTriangle, color: '#fb923c' },
  caution:   { Icon: AlertTriangle, color: '#fb923c' },
  attention: { Icon: AlertTriangle, color: '#fb923c' },
  failure:   { Icon: XCircle,       color: '#f87171' },
  fail:      { Icon: XCircle,       color: '#f87171' },
  missing:   { Icon: XCircle,       color: '#f87171' },
  danger:    { Icon: Flame,         color: '#f87171' },
  error:     { Icon: Flame,         color: '#f87171' },
  bug:       { Icon: Bug,           color: '#f87171' },
  example:   { Icon: FileText,      color: '#a78bfa' },
  quote:     { Icon: Quote,         color: '#94a3b8' },
  cite:      { Icon: Quote,         color: '#94a3b8' },
}

function hastText(node: ElementContent | Element): string {
  if (node.type === 'text') return node.value
  if ('children' in node) return node.children.map(c => hastText(c as ElementContent)).join('')
  return ''
}

function heading(Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return function Heading({ node, children }: { node?: Element; children?: ReactNode }) {
    const id = node ? slugify(hastText(node)) : undefined
    return <Tag id={id}>{children}</Tag>
  }
}

export interface WikiPage {
  id: string
  titulo: string
}

interface MarkdownViewProps {
  content: string
  pages?: WikiPage[]
  onOpenPage?: (pageId: string, heading: string | null) => void
  onMissingPage?: (title: string) => void
  showFrontmatter?: boolean
  className?: string
}

function MarkdownView({ content, pages = [], onOpenPage, onMissingPage, showFrontmatter = true, className }: MarkdownViewProps) {
  const { data, body } = useMemo(() => parseFrontmatter(content), [content])

  const pageIndex = useMemo(() => {
    const map = new Map<string, WikiPage>()
    pages.forEach(p => map.set(normalizeTitle(p.titulo), p))
    return map
  }, [pages])

  const components = useMemo<Components>(() => ({
    h1: heading('h1'), h2: heading('h2'), h3: heading('h3'),
    h4: heading('h4'), h5: heading('h5'), h6: heading('h6'),

    a({ href = '', children }) {
      const wiki = parseWikiHref(href)
      if (wiki) {
        const target = pageIndex.get(normalizeTitle(wiki.page))
        if (target) {
          return (
            <a
              href={href}
              className="wikilink"
              onClick={e => { e.preventDefault(); onOpenPage?.(target.id, wiki.heading) }}
            >
              {children}
            </a>
          )
        }
        return (
          <a
            href={href}
            className="wikilink wikilink-missing"
            title="Esta página todavía no existe. Pulsa para crearla."
            onClick={e => { e.preventDefault(); onMissingPage?.(wiki.page) }}
          >
            {children}
          </a>
        )
      }
      if (href.startsWith('#')) {
        return (
          <a
            href={href}
            onClick={e => {
              e.preventDefault()
              document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {children}
          </a>
        )
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    },

    div({ node, className, children, ...rest }) {
      const type = (node?.properties?.dataCallout as string | undefined) ?? 'note'
      const config = CALLOUTS[type] ?? CALLOUTS.note
      if (className === 'callout') {
        return (
          <div className="callout" style={{ '--callout': config.color } as React.CSSProperties}>
            {children}
          </div>
        )
      }
      if (className === 'callout-title') {
        return (
          <div className="callout-title">
            <config.Icon size={15} className="shrink-0" />
            <span>{children}</span>
          </div>
        )
      }
      return <div className={className} {...rest}>{children}</div>
    },

    table({ children }) {
      return <div className="md-table-wrap"><table>{children}</table></div>
    },

    img({ src, alt }) {
      return <img src={src} alt={alt ?? ''} loading="lazy" />
    },
  }), [pageIndex, onOpenPage, onMissingPage])

  const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []
  const props = Object.entries(data).filter(([key]) => key !== 'tags' && key !== 'title')

  return (
    <div className={cn('md-body', className)}>
      {showFrontmatter && (tags.length > 0 || props.length > 0) && (
        <div className="mb-6 flex flex-col gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag size={12} className="text-text-muted" />
              {tags.map(tag => (
                <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-light">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {props.length > 0 && (
            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
              {props.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-text-muted">{key}</dt>
                  <dd className="min-w-0 break-words font-mono text-text-secondary">
                    {Array.isArray(value) ? value.join(', ') : value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkObsidian]}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}

export default memo(MarkdownView)
