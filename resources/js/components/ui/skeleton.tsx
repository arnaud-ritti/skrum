import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "bg-muted animate-pulse rounded-sm motion-reduce:animate-none motion-reduce:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
