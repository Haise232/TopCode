import { SkeletonBox, SkeletonCard } from '../Skeleton'

export default function CalendarioEsqueleto() {
  return (
    <div className="motion-safe:animate-fade-in h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pt-6 pb-8 flex flex-col gap-6">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-2.5">
            <SkeletonBox className="h-9 w-44 shimmer" />
            <SkeletonBox className="h-3 w-56 shimmer" />
          </div>
          <SkeletonBox className="h-10 w-36 shimmer rounded-xl" />
        </div>
        <SkeletonBox className="h-11 w-full sm:w-72 shimmer rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <SkeletonCard key={i} className="flex gap-4 items-center py-5">
                <SkeletonBox className="h-14 w-14 shrink-0 shimmer rounded-xl" />
                <div className="flex-1 flex flex-col gap-2.5">
                  <SkeletonBox className="h-4 w-2/5 shimmer" />
                  <SkeletonBox className="h-3 w-3/5 shimmer" />
                </div>
              </SkeletonCard>
            ))}
          </div>
          <SkeletonCard className="h-72 shimmer rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
