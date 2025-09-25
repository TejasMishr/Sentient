import * as React from "react"
import { cn } from "@utils/cn"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
	return (
		<input
			type={type}
			className={cn(
				"flex h-10 w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-200 ring-offset-black file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sentient-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
				className
			)}
			ref={ref}
			{...props}
		/>
	)
})
Input.displayName = "Input"

export { Input }