"use client"

import { IconDotsVertical } from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@components/ui/button"

const ChatHeader = ({
	getGreeting,
	userDetails,
	isOptionsOpen,
	setIsOptionsOpen,
	confirmClear,
	setConfirmClear,
	handleClearAllMessages
}) => {
	const renderOptionsMenu = () => (
		<div className="absolute top-4 right-4 md:top-6 md:right-6 z-30">
			<div className="relative">
				<button
					onClick={() => {
						setIsOptionsOpen(!isOptionsOpen)
						setConfirmClear(false) // Reset confirmation on toggle
					}}
					className="p-2 rounded-full bg-neutral-800/50 hover:bg-neutral-700/80 text-white"
				>
					<IconDotsVertical size={20} />
				</button>
				<AnimatePresence>
					{isOptionsOpen && (
						<motion.div
							initial={{ opacity: 0, y: 10, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 10, scale: 0.95 }}
							className="absolute top-full right-0 mt-2 w-48 bg-neutral-900/80 backdrop-blur-md border border-neutral-700 rounded-lg shadow-lg p-1"
						>
							<Button
								onClick={() => {
									if (confirmClear) {
										handleClearAllMessages()
									} else {
										setConfirmClear(true)
									}
								}}
								variant={confirmClear ? "destructive" : "ghost"}
								className="w-full justify-start"
							>
								{confirmClear ? "Confirm Clear?" : "Clear Chat"}
							</Button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	)

	return (
		<>
			{renderOptionsMenu()}
			<div className="text-center">
				<h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-100 to-neutral-400 py-4">
					{getGreeting()},{" "}
					{userDetails?.given_name || "User"}
				</h1>
				<p className="mt-2 text-lg text-neutral-400">
					How can I help you today?
				</p>
			</div>
		</>
	)
}

export default ChatHeader