"use client"

import React, { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@utils/cn"
import useClickOutside from "@hooks/useClickOutside"

const Drawer = ({ isOpen, onClose, children, className, side = "right" }) => {
	const drawerRef = useRef(null)
	useClickOutside(drawerRef, () => {
		if (isOpen) onClose()
	})

	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.key === "Escape" && isOpen) {
				onClose()
			}
		}
		document.addEventListener("keydown", handleKeyDown)
		return () => document.removeEventListener("keydown", handleKeyDown)
	}, [isOpen, onClose])

	const variants = {
		right: {
			initial: { x: "100%" },
			animate: { x: 0 },
			exit: { x: "100%" }
		},
		left: {
			initial: { x: "-100%" },
			animate: { x: 0 },
			exit: { x: "-100%" }
		},
		bottom: {
			initial: { y: "100%" },
			animate: { y: 0 },
			exit: { y: "100%" }
		}
	}

	const transition = {
		type: "spring",
		stiffness: 300,
		damping: 30
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
					/>
					<motion.div
						ref={drawerRef}
						initial="initial"
						animate="animate"
						exit="exit"
						variants={variants[side]}
						transition={transition}
						className={cn(
							"fixed bg-neutral-900/80 backdrop-blur-lg shadow-2xl z-50",
							{
								"top-0 right-0 h-full w-full md:w-[550px] border-l border-neutral-700/80":
									side === "right",
								"bottom-0 left-0 w-full h-[90vh] rounded-t-2xl border-t border-neutral-700/80":
									side === "bottom"
							},
							className
						)}
						role="dialog"
						aria-modal="true"
					>
						{children}
					</motion.div>
				</>
			)}
		</AnimatePresence>
	)
}

export { Drawer }
