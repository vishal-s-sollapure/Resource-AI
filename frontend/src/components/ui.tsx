import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react'
import { cn, statusTone, titleCase } from '../lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  dark: 'btn-dark',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants[variant], size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple'
const badgeTones: Record<Tone, string> = {
  green: 'bg-forest-50 text-forest-700 border-forest-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  gray: 'bg-slate-100 text-slate-600 border-slate-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}

export function Badge({ children, tone = 'gray', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  )
}

export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  return <Badge tone={statusTone(status) as Tone}>{label || titleCase(status)}</Badge>
}

export function DemoBadge({ children = 'Demo data' }: { children?: ReactNode }) {
  return (
    <Badge tone="purple" className="uppercase tracking-wide">
      {children}
    </Badge>
  )
}

export function Field({ label, hint, required, children, className }: { label: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('input', props.className)} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('input min-h-[96px] resize-y', props.className)} />
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  dismissible?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [],
    )
    const timer = window.setTimeout(() => focusable()[0]?.focus(), 0)
    const onKey = (event: KeyboardEvent) => {
      if (!dismissible) return
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [open, dismissible])

  if (!open) return null
  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/65 p-0 backdrop-blur-[3px] animate-fade-in sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) closeRef.current()
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} className={cn('flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-lifted animate-fade-up sm:rounded-3xl', widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold">{title}</h3>
            {description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>}
          </div>
          {dismissible && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-ink-900" aria-label="Close dialog">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
    </Modal>
  )
}

export interface TabItem {
  id: string
  label: string
  count?: number
}

export function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            'whitespace-nowrap rounded-t-lg border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold transition',
            active === item.id ? 'border-forest-600 bg-forest-50/60 text-forest-800' : 'text-slate-500 hover:bg-slate-50 hover:text-ink-900',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={cn('ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]', active === item.id ? 'bg-forest-100 text-forest-700' : 'bg-slate-100 text-slate-500')}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Alert({ tone = 'info', title, children }: { tone?: 'info' | 'success' | 'warning' | 'error'; title?: string; children: ReactNode }) {
  const styles = {
    info: 'border-blue-200 bg-blue-50/80 text-blue-950',
    success: 'border-forest-200 bg-forest-50/80 text-forest-950',
    warning: 'border-amber-200 bg-amber-50/80 text-amber-950',
    error: 'border-red-200 bg-red-50/80 text-red-950',
  }
  const iconStyles = {
    info: 'bg-blue-100 text-blue-700',
    success: 'bg-forest-100 text-forest-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
  }
  const Icon = tone === 'error' || tone === 'warning' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info
  return (
    <div className={cn('flex gap-3 rounded-2xl border p-4 text-sm', styles[tone])}>
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl', iconStyles[tone])}>
        <Icon size={17} />
      </span>
      <div className="leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'forest' }: { label: string; value: string | number; hint?: string; icon?: ReactNode; tone?: 'forest' | 'blue' | 'amber' | 'ink' }) {
  const tones = {
    forest: 'bg-forest-50 text-forest-700 ring-forest-100',
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    ink: 'bg-ink-900 text-white ring-ink-800',
  }
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold leading-none">{value}</p>
          {hint && <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>}
        </div>
        {icon && <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1', tones[tone])}>{icon}</span>}
      </div>
    </div>
  )
}

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex justify-between text-xs font-medium text-slate-600">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-forest-500 to-forest-700 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50/80 px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-700 ring-1 ring-forest-100">{icon}</div>}
      <p className="font-bold">{title}</p>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function LoadingGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid-auto">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card space-y-3 overflow-hidden p-5">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert tone="error" title="Something went wrong">
      <p>{message}</p>
      {onRetry && <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button>}
    </Alert>
  )
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Section({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mb-10', className)}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-ink-900">{value}</span>
    </div>
  )
}
