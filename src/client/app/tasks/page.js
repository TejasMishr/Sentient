"use client"

import { cn } from "@utils/cn"
import React, {
	useRef,
	useState,
	useMemo,
	useEffect,
	useCallback, // eslint-disable-line
	Suspense
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
	IconLoader,
	IconSparkles,
	IconCheck,
	IconPlus,
	IconBolt // Added IconBolt
} from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import toast from "react-hot-toast"
import { Tooltip } from "react-tooltip"

import TaskDetails from "@components/tasks/TaskDetails"
import TaskViewSwitcher from "@components/tasks/TaskViewSwitcher"
import ListView from "@components/tasks/ListView"
import TaskComposer from "@components/tasks/TaskComposer"
import InteractiveNetworkBackground from "@components/ui/InteractiveNetworkBackground"
import { usePlan } from "@hooks/usePlan"
import { useTour } from "@components/LayoutWrapper"
import { Drawer } from "@components/ui/drawer"
import { Button } from "@components/ui/button"

const proPlanFeatures = [
	{ name: "Text Chat", limit: "100 messages per day" },
	{ name: "Voice Chat", limit: "10 minutes per day" },
	{ name: "Async Tasks", limit: "100 tasks per month" },
	{ name: "Active Workflows", limit: "25 recurring & triggered" },
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
								<IconBolt className="text-yellow-400" />
								Unlock Pro Features
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
							<Button
								onClick={handleUpgrade}
								className="w-full bg-brand-orange hover:bg-brand-orange/90 text-brand-black font-semibold"
							>
								Upgrade Now - $9/month
							</Button>
							<Button
								onClick={onClose}
								variant="ghost"
								className="w-full text-neutral-400"
							>
								Not now
							</Button>
						</footer>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

function usePrevious(value) {
	const ref = useRef()
	useEffect(() => {
		ref.current = value
	})
	return ref.current
}

function TasksPageContent() {
	const router = useRouter()
	const searchParams = useSearchParams()

	const [allTasks, setAllTasks] = useState([])
	const [allTools, setAllTools] = useState([])
	const [integrations, setIntegrations] = useState([])
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
	const [composerInitialData, setComposerInitialData] = useState(null)
	const { isPro } = usePlan()
	const tour = useTour()
	const { tourState, setTourState } = tour
	const prevTourState = usePrevious(tourState)

	const demoWorkflow = useMemo(() => {
		if (!tourState.isActive || tourState.step < 6) return null

		return {
			task_id: "demo-workflow-123",
			name: "Daily Email Briefing",
			description:
				"A simulated workflow to summarize unread emails daily.",
			status: "active",
			task_type: "recurring",
			isDemoWorkflow: true,
			created_at: new Date().toISOString()
		}
	}, [tourState.isActive, tourState.step])

	const demoTask = useMemo(() => {
		if (!tourState.isActive || tourState.step < 5) return null

		const subStep = tourState.subStep
		let status = "planning"
		let subTasks = []

		const baseSubTasks = [
			{
				task_id: "demo-sub-1",
				name: "Email Kabeer to ask for availability",
				status: "completed"
			},
			{
				task_id: "demo-sub-2",
				name: "Check email thread for reply from Kabeer",
				status: "completed"
			},
			{
				task_id: "demo-sub-3",
				name: "Schedule calendar event for Monday 5 PM with Kabeer",
				status: "completed"
			}
		]

		if (subStep === 1) {
			status = "processing"
			subTasks = [baseSubTasks[0]]
		} else if (subStep === 2) {
			status = "waiting"
			subTasks = [baseSubTasks[0]]
		} else if (subStep === 3) {
			status = "processing"
			subTasks = [baseSubTasks[0], baseSubTasks[1]]
		} else if (subStep === 4) {
			status = "processing"
			subTasks = [baseSubTasks[0], baseSubTasks[1], baseSubTasks[2]]
		} else if (subStep >= 5) {
			status = "completed"
			subTasks = baseSubTasks
		}

		return {
			task_id: "demo-task-123",
			name: "Coordinate with Kabeer to set up a meeting next week.",
			description:
				"A simulated task to demonstrate the lifecycle of an automated project.",
			status: status,
			task_type: "long_form",
			isDemoTask: true,
			created_at: new Date().toISOString(),
			subTasks: subTasks,
			runs: [
				{
					run_id: "demo-run-1",
					status: status,
					progress_updates: [
						{
							message: {
								type: "info",
								content: `Simulating step: ${status}`
							},
							timestamp: new Date().toISOString()
						}
					]
				}
			]
		}
	}, [tourState.isActive, tourState.step, tourState.subStep])

	const handleClosePanel = useCallback(() => {
		if (tourState.isActive && tourState.step >= 3) {
			// Don't close panel during tour simulation
		} else {
			router.push("/tasks", { scroll: false }) // Clear URL param
		}
		setIsModalOpen(false)
	}, [router, tourState])

	// Effect to sync UI state with the tour state
	useEffect(() => {
		if (tourState.isActive) {
			if (tourState.step === 3) {
				// This is the "Create Task" button step.
				if (isComposerOpen) {
					// If user clicks the button, composer opens, and we advance.
					tour.nextStep()
				} else {
					// Otherwise, ensure composer is closed.
					setIsComposerOpen(false)
				}
			} else if (tourState.step === 4) {
				// This is the composer step. If it's not open or doesn't have the
				// initial data yet, set it up. This prevents re-render loops.
				if (!isComposerOpen || !composerInitialData) {
					setIsComposerOpen(true)
					setComposerInitialData({
						prompt: "Coordinate with Kabeer to set up a meeting next week."
					})
				}
			}
			// For subsequent steps, ensure composer is closed.
			else if (tourState.step > 4 && isComposerOpen) {
				setIsComposerOpen(false)
			}
		}
	}, [
		tourState.isActive,
		tourState.step,
		isComposerOpen,
		tour,
		setComposerInitialData,
		setIsComposerOpen
	])

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

		if (isMobile) {
			// Tour logic: Modal is open ONLY during step 5 AND when the phase is 'panel'.
			if (tourState.isActive && tourState.step === 5) {
				setIsModalOpen(tourState.phase === "panel")
			}
			// Regular logic: Open modal if a task is selected via URL and it exists.
			else if (taskId && selectedTask) {
				setIsModalOpen(true)
			}
			// Cleanup: If no task is selected (or tour ended), close the modal.
			else {
				setIsModalOpen(false)
			}
		} else {
			// On desktop, the modal is never used.
			setIsModalOpen(false)
		}
	}, [searchParams, isMobile, tourState, selectedTask, handleClosePanel])

	const tasksWithDemo = useMemo(() => {
		// Filter(Boolean) removes null/undefined demo tasks
		return [demoTask, demoWorkflow, ...allTasks].filter(Boolean)
	}, [allTasks, demoTask, demoWorkflow])

	const selectedTaskOrDemo = useMemo(() => {
		// During the tour's task simulation step (step 5+), force the demo task data into the panel.
		if (tourState.isActive && tourState.step >= 5) {
			return demoTask
		}
		// Otherwise, use the task selected via the URL parameter for regular use.
		return selectedTask
	}, [tourState, demoTask, selectedTask])

	const fetchTasks = useCallback(async () => {
		if (tourState.isActive) {
			setIsLoading(false)
			return
		}
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
			setIntegrations(integrationsData.integrations || [])
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
	}, [tourState.isActive])

	useEffect(() => {
		// When tour ends, refetch tasks
		if (!tourState.isActive && prevTourState?.isActive) {
			fetchTasks()
		}
	}, [tourState.isActive, prevTourState?.isActive, fetchTasks])

	useEffect(() => {
		fetchTasks()
	}, [fetchTasks])

	useEffect(() => {
		const handleBackendUpdate = () => {
			console.log(
				"Received tasksUpdatedFromBackend event, fetching tasks..."
			)
			toast.success("Task list updated from backend.")
			fetchTasks()
		}
		window.addEventListener("tasksUpdatedFromBackend", handleBackendUpdate)
		return () => {
			window.removeEventListener(
				"tasksUpdatedFromBackend",
				handleBackendUpdate
			)
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
		const toastId = toast.loading(
			view === "workflows" ? "Creating workflow..." : "Creating task..."
		)
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

			toast.success(
				data.message ||
					(view === "workflows"
						? "Workflow created!"
						: "Task created!"),
				{ id: toastId }
			)
			await fetchTasks()
			// The view is already correct, so no need to set it again.
			// This fixes the issue of being switched to 'tasks' after creating a workflow.
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

	const handleExampleClick = (example) => {
		if (example.type === "workflow") {
			setView("workflows")
		} else {
			setView("tasks")
		}
		setComposerInitialData(example)
		setIsComposerOpen(true)
	}

	const renderTaskDetails = (task) => (
		<TaskDetails
			task={task}
			allTools={allTools}
			integrations={integrations}
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
				<main className="flex-1 flex flex-col overflow-hidden relative md:pl-6 min-w-0">
					<div className="absolute -top-[250px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-orange/10 rounded-full blur-3xl -z-10" />
					<header className="p-6 pt-20 md:pt-6 flex-shrink-0 flex items-center justify-between bg-transparent">
						<h1 className="text-3xl font-bold text-white">Tasks</h1>
						<div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
							<TaskViewSwitcher view={view} setView={setView} />
						</div>
					</header>

					<div
						className="flex-1 overflow-y-auto custom-scrollbar px-2 md:px-6 pb-24"
						style={{
							display: isMobile && isModalOpen ? "none" : "block"
						}}
						key="list-view-container"
					>
						{isLoading && !demoTask ? (
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
										tasks={tasksWithDemo}
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

					{/* Floating Task Composer */}
					<AnimatePresence>
						{isComposerOpen && (
							<TaskComposer
								view={view}
								onTaskCreated={(payload) => {
									if (
										tourState.isActive &&
										tourState.step === 4
									) {
										setIsComposerOpen(false)
										setComposerInitialData(null)
										tour.nextStep() // Advance the tour
										return
									}
									// Otherwise, proceed with normal task creation.
									handleCreateTask(payload)
									setIsComposerOpen(false)
									setComposerInitialData(null)
								}}
								isPro={isPro}
								onUpgradeClick={() => setUpgradeModalOpen(true)}
								onClose={() => {
									if (
										tourState.isActive &&
										tourState.step === 4
									) {
										// If user closes manually, also advance the tour.
										tour.nextStep()
									}
									setIsComposerOpen(false)
									setComposerInitialData(null)
								}}
								initialData={composerInitialData}
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
								transition={{
									duration: 0.3,
									ease: "easeInOut"
								}}
								className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40"
							>
								<Button
									onClick={() => setIsComposerOpen(true)}
									aria-label={
										view === "workflows"
											? "Create new workflow"
											: "Create new task"
									}
									data-tour-id="create-task-button"
									className="gap-2 rounded-xl px-6 py-3 font-semibold shadow-2xl transition-all duration-300 hover:scale-105 bg-brand-orange text-brand-black hover:bg-brand-orange/90"
								>
									<IconPlus size={20} />
									<span>
										{view === "workflows"
											? "Create Workflow"
											: "Create Task"}
									</span>
								</Button>
							</motion.div>
						)}
					</AnimatePresence>
				</main>

				{/* Desktop Drawer */}
				<Drawer
					isOpen={!isMobile && !!selectedTaskOrDemo}
					onClose={handleClosePanel}
				>
					{selectedTaskOrDemo &&
						renderTaskDetails(selectedTaskOrDemo)}
				</Drawer>
			</div>

			{/* Mobile Drawer */}
			<Drawer
				isOpen={isMobile && isModalOpen && !!selectedTaskOrDemo}
				onClose={handleClosePanel}
				side="bottom"
				className={cn(
					// Let the tour component control the overlay during the tour
					tourState.isActive && "!bg-transparent"
				)}
			>
				{selectedTaskOrDemo && renderTaskDetails(selectedTaskOrDemo)}
			</Drawer>
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
