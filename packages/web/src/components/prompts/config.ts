import type { ElementType } from 'react'
import { Code2, GraduationCap, PenLine, Bug, Image as ImageIcon, LayoutGrid } from 'lucide-react'
import type { PromptCategoria, PromptModelo } from '@topcode/shared'

export const CATEGORIAS: Record<PromptCategoria, { label: string; Icon: ElementType; color: string }> = {
  general:    { label: 'General',    Icon: LayoutGrid,    color: 'var(--color-text-secondary)' },
  codigo:     { label: 'Código',     Icon: Code2,         color: '#60a5fa' },
  depuracion: { label: 'Depuración', Icon: Bug,           color: '#f87171' },
  estudio:    { label: 'Estudio',    Icon: GraduationCap, color: '#fbbf24' },
  escritura:  { label: 'Escritura',  Icon: PenLine,       color: '#2dd4bf' },
  imagen:     { label: 'Imagen',     Icon: ImageIcon,     color: '#a78bfa' },
}

export const MODELOS: Record<PromptModelo, string> = {
  cualquiera: 'Cualquier IA',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  copilot: 'Copilot',
}

// Enlaces que abren el chat de la IA con el prompt ya escrito. Gemini no acepta el
// prompt por URL, así que se abre vacío y el prompt se copia al portapapeles para pegarlo.
export const ABRIR_EN: { label: string; url: (q: string) => string; copiar?: boolean }[] = [
  { label: 'ChatGPT', url: q => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  { label: 'Claude',  url: q => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  { label: 'Gemini',  url: () => 'https://gemini.google.com/app', copiar: true },
]
