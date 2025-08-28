"use client"

import React, {
	useState,
	useMemo,
	useEffect,
	useCallback,
	Suspense
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
	IconLoader,
	IconSparkles,
	IconCheck,
	IconPlus
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import toast from "react-hot-toast"
import { Tooltip } from "react-tooltip"

import TaskDetailsPanel from "@components/tasks/TaskDetailsPanel"
import TaskViewSwitcher from "@components/tasks/TaskViewSwitcher"
import ListView from "@components/tasks/ListView"
import TaskComposer from "@components/tasks/TaskComposer"
import InteractiveNetworkBackground from "@components/ui/InteractiveNetworkBackground"
import { usePlan } from "@hooks/usePlan"

const proPlanFeatures = [
	{ name: "Text Chat", limit: "100 messages per day" },
	{ name: "Voice Chat", limit: "10 minutes per day" },
	{ name: "One-Time Tasks", limit: "20 async tasks per day" },
	{ name: "Recurring Tasks", limit: "10 active recurring workflows" },
	{ name: "Triggered Tasks", limit: "10 triggered workflows" },
	{
		name: "Parallel Agents",
		limit: "5 complex tasks per day with 50 sub agents"
	},
	{ name: "File Uploads", limit: "20 files per day" },
	{ name: "Memories", limit: "Unlimited memories" },
	{
		name: "Other Integrations",
		limit: "Notion, GitHub, Slack, Discord, Trello"
	}
]

const UpgradeToProModal = ({ isOpen, onClose }) => {
	if (!isOpen) return null

	const handleUpgrade = () => {
		const dashboardUrl = process.env.NEXT_PUBLIC_LANDING_PAGE_URL
		if (dashboardUrl) {
			window.location.href = `${dashboardUrl}/dashboard`
		}
		onClose()
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4"
					onClick={onClose}
				>
					<motion.div
						initial={{ scale: 0.95, y: 20 }}
						animate={{ scale: 1, y: 0 }}
						exit={{ scale: 0.95, y: -20 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
						onClick={(e) => e.stopPropagation()}
						className="relative bg-neutral-900/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-neutral-700 flex flex-col"
					>
						<header className="text-center mb-4">
							<h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
								<IconSparkles className="text-brand-orange" />
								Upgrade to Pro
							</h2>
							<p className="text-neutral-400 mt-2">
								Unlock Parallel Agents and other powerful
								features.
							</p>
						</header>
						<main className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 my-4">
							{proPlanFeatures.map((feature) => (
								<div
									key={feature.name}
									className="flex items-start gap-2.5"
								>
									<IconCheck
										size={18}
										className="text-green-400 flex-shrink-0 mt-0.5"
									/>
									<div>
										<p className="text-white text-sm font-medium">
											{feature.name}
										</p>
										<p className="text-neutral-400 text-xs">
											{feature.limit}
										</p>
									</div>
								</div>
							))}
						</main>
						<footer className="mt-4 flex flex-col gap-2">
							<button
								onClick={handleUpgrade}
								className="w-full py-2.5 px-5 rounded-lg bg-brand-orange hover:bg-brand-orange/90 text-brand-black font-semibold transition-colors"
							>
								Upgrade to Pro - $9/month
							</button>
							<button
								onClick={onClose}
								className="w-full py-2 px-5 rounded-lg hover:bg-neutral-800 text-sm font-medium text-neutral-400"
							>
								Not now
							</button>
						</footer>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function TasksPageContent() {
	const router = useRouter()
	const searchParams = useSearchParams()

	const [allTasks, setAllTasks] = useState([])
	const [allTools, setAllTools] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [view, setView] = useState("tasks") // 'tasks' or 'workflows'
	const [isMobile, setIsMobile] = useState(false)

	const selectedTaskId = searchParams.get("taskId")
	const selectedTask = useMemo(() => {
		return allTasks.find((t) => t.task_id === selectedTaskId) || null
	}, [allTasks, selectedTaskId])

	const [isModalOpen, setIsModalOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false)
	const [isComposerOpen, setIsComposerOpen] = useState(false)
	const { isPro } = usePlan()

	useEffect(() => {
		const checkMobile = () => window.innerWidth < 768
		setIsMobile(checkMobile())

		// Open modal on mobile if a task is selected
		if (checkMobile() && selectedTaskId) {
			setIsModalOpen(true)
		}

		const handleResize = () => {
			const mobile = checkMobile()
			if (mobile !== isMobile) {
				setIsMobile(mobile)
			}
		}

		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	}, [isMobile, selectedTaskId])

	useEffect(() => {
		const taskId = searchParams.get("taskId")
		if (taskId) {
			const task = allTasks.find((t) => t.task_id === taskId)
			if (task) {
				if (isMobile) setIsModalOpen(true)
			}
		} else {
			setIsModalOpen(false)
		}
	}, [searchParams, allTasks, isMobile])

	const fetchTasks = useCallback(async () => {
		setIsLoading(true)
		try {
			const tasksRes = await fetch("/api/tasks", { method: "POST" })
			if (!tasksRes.ok) throw new Error("Failed to fetch tasks")
			const tasksData = await tasksRes.json()
			const rawTasks = Array.isArray(tasksData.tasks)
				? tasksData.tasks
				: []
			setAllTasks(rawTasks)

			const integrationsRes = await fetch("/api/settings/integrations", {
				method: "POST"
			})
			if (!integrationsRes.ok)
				throw new Error("Failed to fetch integrations")
			const integrationsData = await integrationsRes.json()
			const tools = integrationsData.integrations.map((i) => ({
				name: i.name,
				display_name: i.display_name
			}))
			setAllTools(tools)
		} catch (error) {
			toast.error(`Error fetching data: ${error.message}`)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchTasks()
	}, [fetchTasks])

	useEffect(() => {
		const handleBackendUpdate = () => {
			console.log("Received task_list_updated event, fetching tasks...")
			toast.success("Task list updated from backend.")
			fetchTasks()
		}
		window.addEventListener("task_list_updated", handleBackendUpdate)
		return () => {
			window.removeEventListener("task_list_updated", handleBackendUpdate)
		}
	}, [fetchTasks])

	const handleAction = useCallback(
		async (actionFn, successMessage, ...args) => {
			const toastId = toast.loading("Processing...")
			try {
				const response = await actionFn(...args)
				if (!response.ok) {
					const errorData = await response.json()
					throw new Error(errorData.error || "Action failed")
				}
				toast.success(successMessage, { id: toastId })
				await fetchTasks()
			} catch (error) {
				toast.error(`Error: ${error.message}`, { id: toastId })
			}
		},
		[fetchTasks]
	)

	const handleAnswerClarifications = async (taskId, answers) => {
		await handleAction(
			() =>
				fetch("/api/tasks/answer-clarifications", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ taskId, answers })
				}),
			"Answers submitted successfully. The task will now resume."
		)
		handleClosePanel()
	}

	const handleAnswerLongFormClarification = async (
		taskId,
		requestId,
		answer
	) => {
		await handleAction(
			() =>
				fetch(`/api/tasks/${taskId}/answer-clarification`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ requestId, answer })
				}),
			"Answer submitted. The task will now resume."
		)
	}

	const handleCreateTask = async (payload) => {
		const toastId = toast.loading("Creating task...")
		try {
			const response = await fetch("/api/tasks/add", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			})
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}))
				const error = new Error(errorData.error || "Failed to add task")
				error.status = response.status
				throw error
			}
			const data = await response.json()

			toast.success(data.message || "Task created!", { id: toastId })
			await fetchTasks()
			setView("tasks")
		} catch (error) {
			if (error.status === 429) {
				toast.error(
					error.message || "You've reached your daily task limit.",
					{ id: toastId }
				)
				if (!isPro) setUpgradeModalOpen(true)
			} else {
				toast.error(`Error: ${error.message}`, { id: toastId })
			}
		}
	}

	const handleResumeTask = async (taskId) => {
		await handleAction(
			() =>
				fetch(`/api/tasks/${taskId}/action`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action: "resume" })
				}),
			"Task resumed."
		)
	}

	const handleUpdateTask = async (updatedTask) => {
		await handleAction(
			() =>
				fetch("/api/tasks/update", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...updatedTask,
						taskId: updatedTask.task_id
					})
				}),
			"Task updated!"
		)
	}

	const handleSelectItem = (item) => {
		const taskId = item.task_id
		router.push(`/tasks?taskId=${taskId}`, { scroll: false })
		if (isMobile) {
			setIsModalOpen(true)
		}
	}

	const handleClosePanel = () => {
		router.push("/tasks", { scroll: false }) // Clear URL param
		setIsModalOpen(false)
	}

	const handleExampleClick = (prompt) => {
		handleCreateTask({ prompt })
	}

	const renderTaskDetails = (task) => (
		<TaskDetailsPanel
			task={task}
			allTools={allTools}
			onClose={handleClosePanel}
			onSave={handleUpdateTask}
			onAnswerClarifications={handleAnswerClarifications}
			onAnswerLongFormClarification={handleAnswerLongFormClarification}
			onResumeTask={handleResumeTask}
			onSelectTask={handleSelectItem}
			onDelete={(taskId) =>
				handleAction(
					() =>
						fetch(`/api/tasks/delete`, {
							method: "POST",
							body: JSON.stringify({ taskId }),
							headers: { "Content-Type": "application/json" }
						}),
					"Task deleted."
				)
			}
			onApprove={(taskId) =>
				handleAction(
					() =>
						fetch(`/api/tasks/approve`, {
							method: "POST",
							body: JSON.stringify({ taskId }),
							headers: { "Content-Type": "application/json" }
						}),
					"Task approved."
				)
			}
			onRerun={(taskId) =>
				handleAction(
					() =>
						fetch("/api/tasks/rerun", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ taskId })
						}),
					"Task re-run initiated."
				)
			}
			onArchiveTask={(taskId) =>
				handleAction(
					() =>
						fetch(`/api/tasks/update`, {
							method: "POST",
							body: JSON.stringify({
								taskId,
								status: "archived"
							}),
							headers: { "Content-Type": "application/json" }
						}),
					"Task archived."
				)
			}
			onSendChatMessage={(taskId, message) =>
				handleAction(
					() =>
						fetch(`/api/tasks/chat`, {
							method: "POST",
							body: JSON.stringify({ taskId, message }),
							headers: { "Content-Type": "application/json" }
						}),
					"Message sent."
				)
			}
		/>
	)

	return (
		<div className="flex-1 flex h-full text-white overflow-hidden">
			<Tooltip
				id="tasks-tooltip"
				place="right"
				style={{ zIndex: 9999 }}
			/>
			<UpgradeToProModal
				isOpen={isUpgradeModalOpen}
				onClose={() => setUpgradeModalOpen(false)}
			/>
			<div className="flex-1 flex overflow-hidden relative">
				<div className="absolute inset-0 z-[-1] network-grid-background">
					<InteractiveNetworkBackground />
				</div>
				{/* Main Content Panel */}
				<main className="flex-1 flex flex-col overflow-hidden relative w-full">
					<div className="absolute -top-[250px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-orange/10 rounded-full blur-3xl -z-10" />
					<header className="p-6 pt-20 md:pt-6 flex-shrink-0 flex items-center justify-between bg-transparent">
						<h1 className="text-3xl font-bold text-white">Tasks</h1>
						<div className="absolute top-6 left-1/2 -translate-x-1/2">
							<TaskViewSwitcher view={view} setView={setView} />
						</div>
					</header>

					<div
						className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 pb-24"
						key="list-view-container"
					>
						{isLoading ? (
							<div className="flex justify-center items-center h-full">
								<IconLoader className="w-8 h-8 animate-spin text-sentient-blue" />
							</div>
						) : (
							<AnimatePresence mode="wait">
								<motion.div
									key={view}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.3 }}
									className="h-full max-w-7xl mx-auto"
								>
									<ListView
										tasks={allTasks}
										view={view}
										onSelectTask={handleSelectItem}
										searchQuery={searchQuery}
										onSearchChange={setSearchQuery}
										onExampleClick={handleExampleClick}
									/>
								</motion.div>
							</AnimatePresence>
						)}
					</div>
				</main>

				{/* Floating Task Composer */}
				<AnimatePresence>
					{isComposerOpen && (
						<TaskComposer
							view={view}
							onTaskCreated={(payload) => {
								handleCreateTask(payload)
								setIsComposerOpen(false) // Close on creation
							}}
							isPro={isPro}
							onUpgradeClick={() => setUpgradeModalOpen(true)}
							onClose={() => setIsComposerOpen(false)}
						/>
					)}
				</AnimatePresence>

				{/* Floating Action Button */}
				<AnimatePresence>
					{!isComposerOpen && (
						<motion.div
							initial={{ opacity: 0, y: 50, scale: 0.8 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: 50, scale: 0.8 }}
							transition={{ duration: 0.3, ease: "easeInOut" }}
							className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50"
						>
							<button
								onClick={() => setIsComposerOpen(true)}
								className="flex items-center gap-2 rounded-xl bg-brand-orange px-6 py-3 font-semibold text-brand-black shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-brand-orange/90"
								aria-label="Create new task"
							>
								<IconPlus size={20} />
								<span>Create Task</span>
							</button>
						</motion.div>
					)}
				</AnimatePresence>
				<AnimatePresence>
					{!isMobile && selectedTask && (
						<motion.div
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{
								type: "spring",
								stiffness: 300,
								damping: 30
							}}
							className="absolute top-0 right-0 h-full w-full max-w-[550px] bg-neutral-900/80 backdrop-blur-lg z-50"
						>
							{renderTaskDetails(selectedTask)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			<AnimatePresence>
				{isMobile && isModalOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/70 z-[70] md:hidden"
					>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: "0%" }}
							exit={{ y: "100%" }}
							transition={{
								type: "spring",
								stiffness: 300,
								damping: 30
							}}
							className="absolute inset-0"
						>
							{selectedTask && renderTaskDetails(selectedTask)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default function TasksPage() {
	return (
		<Suspense
			fallback={
				<div className="flex-1 flex h-full bg-black text-white overflow-hidden justify-center items-center">
					<IconLoader className="w-10 h-10 animate-spin text-[var(--color-accent-blue)]" />
				</div>
			}
		>
			<TasksPageContent />
		</Suspense>
	)
}
