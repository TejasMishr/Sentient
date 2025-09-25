"use client"

import { IconLoader } from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@utils/cn"
import ChatBubble from "@components/chat/ChatBubble"
import { TextShimmer } from "@components/ui/text-shimmer"

const ChatMessageList = ({
	scrollContainerRef,
	isLoadingOlder,
	displayedMessages,
	thinking,
	statusText,
	chatEndRef,
	handleReply,
	handleDeleteMessage
}) => {
	return (
		<div
			ref={scrollContainerRef}
			className="w-full max-w-4xl px-2 mx-auto flex flex-col gap-3 md:gap-4 flex-1"
		>
			{isLoadingOlder && (
				<div className="flex justify-center py-4">
					<IconLoader className="animate-spin text-neutral-500" />
				</div>
			)}
			{displayedMessages.map((msg, i) => (
				<div
					key={msg.id || i}
					id={`message-${msg.id}`}
					className={cn(
						"flex w-full",
						msg.role === "user" ? "justify-end" : "justify-start"
					)}
				>
					<ChatBubble
						role={msg.role}
						content={msg.content}
						tools={msg.tools || []}
						turn_steps={msg.turn_steps || []} // --- CHANGED --- Pass turn_steps instead of old props
						onReply={handleReply}
						message={msg}
						allMessages={displayedMessages}
						isStreaming={
							thinking && i === displayedMessages.length - 1
						}
						onDelete={handleDeleteMessage}
					/>
				</div>
			))}
			<div className="flex w-full justify-start">
				<AnimatePresence>
					{thinking && (
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 10 }}
							className="flex items-center gap-2 p-3 bg-neutral-800/50 backdrop-blur-sm rounded-2xl self-start"
						>
							<TextShimmer
								className="font-mono text-sm"
								duration={1.5}
							>
								{statusText || "Thinking..."}
							</TextShimmer>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<div ref={chatEndRef} />
		</div>
	)
}

export default ChatMessageList
