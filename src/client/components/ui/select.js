import * as React from "react"
import { cn } from "@utils/cn"

const Select = React.forwardRef(({ className, children, ...props }, ref) => {
	return (
		<select
			className={cn(
				"flex h-10 w-full items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-200 ring-offset-black placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-sentient-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-neutral-800",
				className
			)}
			ref={ref}
			{...props}
		>
			{children}
		</select>
	)
})
Select.displayName = "Select"

export { Select }