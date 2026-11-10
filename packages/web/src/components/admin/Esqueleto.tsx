import { SkeletonBox } from '../Skeleton'
import { cn } from '../ui/cn'
import { SUPERFICIE } from '../ui/estilos'

export default function Esqueleto() {
  return (
    <div className="h-full overflow-y-auto" role="status" aria-label="Cargando panel">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-10 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <SkeletonBox className="h-9 w-48" />
          <SkeletonBox className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={cn(SUPERFICIE, 'p-4 flex flex-col gap-2')}>
              <SkeletonBox className="h-3 w-16" /><SkeletonBox className="h-7 w-10" />
            </div>
          ))}
        </div>
        <div className={cn(SUPERFICIE, 'overflow-hidden divide-y divide-ov/[0.07]')}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <SkeletonBox className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 flex flex-col gap-2"><SkeletonBox className="h-4 w-32" /><SkeletonBox className="h-3 w-48" /></div>
              <SkeletonBox className="h-8 w-24 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
