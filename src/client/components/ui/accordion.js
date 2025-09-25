"use client"

import React, { createContext, useContext, useState } from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { cn } from "@utils/cn"

const AccordionContext = createContext({})

function useAccordion() {
	const context = useContext(AccordionContext)
	if (!context) {
		throw new Error("useAccordion must be used within an Accordion")
	}
	return context
}

const Accordion = ({
	children,
	className,
	collapsible = false,
	type = "single",
	defaultValue,
	...props
}) => {
	const [value, setValue] = useState(
		type === "multiple" ? defaultValue || [] : defaultValue || null
	)

	const toggleValue = (itemValue) => {
		if (type === "multiple") {
			setValue((prev) =>
				prev.includes(itemValue)
					? prev.filter((v) => v !== itemValue)
					: [...prev, itemValue]
			)
		} else {
			setValue((prev) => (prev === itemValue && collapsible ? null : itemValue))
		}
	}

	return (
		<AccordionContext.Provider value={{ value, toggleValue, type }}>
			<div className={cn("w-full", className)} {...props}>
				{children}
			</div>
		</AccordionContext.Provider>
	)
}

const AccordionItem = React.forwardRef(
	({ children, className, value, ...props }, ref) => {
		const { value: contextValue } = useAccordion()
		const isExpanded = Array.isArray(contextValue)
			? contextValue.includes(value)
			: contextValue === value

		return (
			<div
				ref={ref}
				className={cn("border-b border-neutral-800", className)}
				{...props}
			>
				{React.Children.map(children, (child) =>
					React.cloneElement(child, { isExpanded, value })
				)}
			</div>
		)
	}
)
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef(
	({ children, className, isExpanded, value, ...props }, ref) => {
		const { toggleValue } = useAccordion()
		return (
			<button
				ref={ref}
				onClick={() => toggleValue(value)}
				className={cn(
					"flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline",
					className
				)}
				{...props}
			>
				{children}
			</button>
		)
	}
)
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef(
	({ children, className, isExpanded, ...props }, ref) => {
		return (
			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.div
						ref={ref}
						initial="collapsed"
						animate="expanded"
						exit="collapsed"
						variants={{
							expanded: { height: "auto", opacity: 1 },
							collapsed: { height: 0, opacity: 0 }
						}}
						transition={{ duration: 0.3, ease: "easeInOut" }}
						className={cn("overflow-hidden", className)}
						{...props}
					>
						<div className="pb-4 pt-0">{children}</div>
					</motion.div>
				)}
			</AnimatePresence>
		)
	}
)
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }