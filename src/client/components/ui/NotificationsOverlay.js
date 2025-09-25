"use client"

import React, { useState, useCallback } from "react" // eslint-disable-line
import toast from "react-hot-toast"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
	IconLoader,
	IconBell,
	IconAlertCircle,
	IconX,
	IconArrowRight
} from "@tabler/icons-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Drawer } from "@components/ui/drawer"

const NotificationItem = ({
	notification,
	onDelete,
	onGeneralClick,
	userTimezone
}) => {
	let formattedTimestamp = "..." // Default placeholder

	try {
		const date = parseISO(notification.timestamp)
		if (userTimezone) {
			formattedTimestamp = new Intl.DateTimeFormat(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
				hour12: true,
				timeZone: userTimezone
			}).format(date)
		} else {
			formattedTimestamp = formatDistanceToNow(date, { addSuffix: true })
		}
	} catch (e) {
		formattedTimestamp = "Recently" // Fallback for invalid date
	}

	const handleClick = () => {
		onGeneralClick(notification)
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, scale: 0.95 }}
			className="bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50 shadow-sm transition-colors group"
		>
			<div
				onClick={handleClick}
				className="flex items-start gap-4 cursor-pointer hover:bg-neutral-700/70 -m-2 p-2 rounded-md"
			>
				<div className="flex-shrink-0 pt-1 self-start">
					<IconBell className="w-5 h-5 text-[var(--color-accent-blue)]" />
				</div>
				<div className="flex-grow">
					<div className="text-neutral-100 text-sm leading-relaxed mb-1">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{notification.message || "No message content."}
						</ReactMarkdown>
					</div>
					<p className="text-neutral-400 text-xs">
						{formattedTimestamp}
					</p>
				</div>
				<div className="flex items-center gap-1 flex-shrink-0 self-start pt-1">
					<button
						onClick={(e) => {
							e.stopPropagation()
							onDelete(notification.id)
						}}
						className="p-1.5 text-neutral-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-neutral-600 hover:text-red-400 transition-all"
					>
						<IconX size={14} />
					</button>
					{notification.task_id && (
						<IconArrowRight className="w-5 h-5 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
					)}
				</div>
			</div>
		</motion.div>
	)
}

const NotificationsOverlay = ({ onClose, notifRefreshKey }) => {
	const queryClient = useQueryClient()
	const router = useRouter()

	const {
		data: notifications = [],
		isLoading,
		isError,
		error
	} = useQuery({
		queryKey: ["notifications", notifRefreshKey],
		queryFn: async () => {
			const response = await fetch("/api/notifications")
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.error ||
						`Server responded with ${response.status}`
				)
			}
			const data = await response.json()
			return (data.notifications || []).sort(
				(a, b) => new Date(b.timestamp) - new Date(a.timestamp)
			)
		}
	})

	const { data: userTimezone } = useQuery({
		queryKey: ["userTimezone"],
		queryFn: async () => {
			const response = await fetch("/api/user/data", { method: "POST" })
			if (!response.ok) throw new Error("Failed to fetch user data")
			const result = await response.json()
			return result?.data?.personalInfo?.timezone
		},
		staleTime: Infinity // Timezone is static for the session
	})

	const deleteNotificationMutation = useMutation({
		mutationFn: (notificationId) =>
			fetch("/api/notifications/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ notification_id: notificationId })
			}).then((res) => {
				if (!res.ok) throw new Error("Failed to delete notification")
			}),
		onMutate: async (notificationId) => {
			await queryClient.cancelQueries({
				queryKey: ["notifications", notifRefreshKey]
			})
			const previousNotifications = queryClient.getQueryData([
				"notifications",
				notifRefreshKey
			])
			queryClient.setQueryData(
				["notifications", notifRefreshKey],
				(old = []) => old.filter((n) => n.id !== notificationId)
			)
			return { previousNotifications }
		},
		onSuccess: () => {
			toast.success("Notification dismissed.")
		},
		onError: (err, vars, context) => {
			queryClient.setQueryData(
				["notifications", notifRefreshKey],
				context.previousNotifications
			)
			toast.error(`Error dismissing notification: ${err.message}`)
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: ["notifications", notifRefreshKey]
			})
		}
	})

	const handleSuggestionAction = async (notificationId, action) => {
		const originalNotifications = [...notifications]
		setNotifications(notifications.filter((n) => n.id !== notificationId))

		try {
			const response = await fetch("/api/proactivity/action", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					notification_id: notificationId,
					user_action: action
				})
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Failed to process action")
			}
			toast.success(`Suggestion ${action}.`)
		} catch (err) {
			toast.error(`Error: ${err.message}`)
			setNotifications(originalNotifications)
		}
	}

	const handleNotificationClick = (notif) => {
		if (notif.task_id) {
			router.push(`/tasks?taskId=${notif.task_id}`)
		}
		onClose()
	}

	const clearAllMutation = useMutation({
		mutationFn: () =>
			fetch("/api/notifications/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ delete_all: true }) // New API call
			}).then((res) => {
				if (!res.ok)
					throw new Error("Failed to dismiss all notifications")
			}),
		onSuccess: () => {
			toast.success("All notifications dismissed.")
			queryClient.invalidateQueries({
				queryKey: ["notifications", notifRefreshKey]
			})
		},
		onError: (err) => toast.error(`Error: ${err.message}`)
	})

	const overlayVariants = {
		hidden: { opacity: 0, y: 20, scale: 0.95 },
		visible: { opacity: 1, y: 0, scale: 1 },
		exit: { opacity: 0, y: 20, scale: 0.95 }
	}

	return (
		<Drawer isOpen={true} onClose={onClose} className="w-full max-w-md">
			<div
				onClick={(e) => e.stopPropagation()} // Prevent drawer from closing when clicking inside
				className="h-full flex flex-col p-4"
			>
				<header className="flex justify-between items-center mb-4 flex-shrink-0">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<IconBell /> Notifications
					</h2>
					<button
						onClick={onClose}
						className="p-1.5 rounded-full hover:bg-neutral-700"
					>
						<IconX size={18} />
					</button>
				</header>
				<main className="flex-1 w-full flex flex-col overflow-hidden">
					{isLoading ? (
						<div className="flex-grow flex flex-col justify-center items-center text-center p-4">
							<IconLoader className="w-8 h-8 text-[var(--color-accent-blue)] animate-spin" />
							<span className="text-neutral-400 mt-2">
								Loading...
							</span>
						</div>
					) : isError ? (
						<div className="flex-grow flex flex-col justify-center items-center text-center p-4">
							<IconAlertCircle className="w-10 h-10 text-red-500 mb-3" />
							<p className="text-red-400">
								Could not load notifications
							</p>
							<p className="text-neutral-500 text-sm mt-1">
								{error.message}
							</p>
						</div>
					) : notifications.length === 0 ? (
						<div className="flex-grow flex flex-col justify-center items-center text-center p-4">
							<IconBell className="w-12 h-12 text-neutral-600 mb-3" />
							<p className="text-neutral-400">All caught up!</p>
							<p className="text-neutral-500 text-sm">
								You have no new notifications.
							</p>
						</div>
					) : (
						<div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
							{notifications.map((notif) => (
								<NotificationItem
									key={notif.id}
									notification={notif}
									userTimezone={userTimezone}
									onDelete={(id) =>
										deleteNotificationMutation.mutate(id)
									}
									onAction={handleSuggestionAction}
									onGeneralClick={handleNotificationClick}
								/>
							))}
						</div>
					)}
				</main>
				{notifications.length > 0 && !isLoading && (
					<footer className="mt-4 pt-3 border-t border-neutral-800 flex-shrink-0">
						<button // prettier-ignore
							onClick={() => {
								if (window.confirm("Are you sure?"))
									clearAllMutation.mutate()
							}}
							className="w-full text-center text-sm text-neutral-400 hover:text-white hover:bg-neutral-700/50 py-2 rounded-lg transition-colors"
						>
							Dismiss All
						</button>
					</footer>
				)}
			</div>
		</Drawer>
	)
}

export default NotificationsOverlay
