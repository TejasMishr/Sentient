"use client"

import React, { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconX } from "@tabler/icons-react"
import { cn } from "@utils/cn"
import useClickOutside from "@hooks/useClickOutside"

const ModalDialog = ({ isOpen, onClose, children, className }) => {
	const modalRef = useRef(null)
	useClickOutside(modalRef, () => {
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

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
				>
					<motion.div
						ref={modalRef}
						initial={{ scale: 0.95, y: 20 }}
						animate={{ scale: 1, y: 0 }}
						exit={{ scale: 0.95, y: -20 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
						className={cn(
							"relative bg-neutral-800 rounded-lg shadow-xl w-full max-w-md border border-neutral-700",
							className
						)}
						role="dialog"
						aria-modal="true"
					>
						{children}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

const ModalHeader = ({ children, className }) => (
	<div
		className={cn(
			"flex justify-between items-center p-6 border-b border-neutral-700",
			className
		)}
	>
		{children}
	</div>
)

const ModalTitle = ({ children, className }) => (
	<h3 className={cn("text-lg font-semibold text-white", className)}>
		{children}
	</h3>
)

const ModalCloseButton = ({ onClose }) => (
	<button onClick={onClose} className="text-gray-400 hover:text-white">
		<IconX size={22} />
	</button>
)

const ModalBody = ({ children, className }) => (
	<div className={cn("p-6", className)}>{children}</div>
)

const ModalFooter = ({ children, className }) => (
	<div
		className={cn(
			"flex items-center gap-3 justify-end p-6 border-t border-neutral-700",
			className
		)}
	>
		{children}
	</div>
)

export {
	ModalDialog,
	ModalHeader,
	ModalTitle,
	ModalCloseButton,
	ModalBody,
	ModalFooter
}
