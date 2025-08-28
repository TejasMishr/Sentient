"use client"
import React, { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { IconSearch, IconFilter } from "@tabler/icons-react"
import TaskCardList from "./TaskCardList"
import CollapsibleSection from "./CollapsibleSection"
import WelcomePanel from "./WelcomePanel"
import { startOfWeek, isToday, isWithinInterval, startOfMonth } from "date-fns"
import { cn } from "@utils/cn"

const ListView = ({
	tasks,
	view, // 'tasks' or 'workflows'
	onSelectTask,
	searchQuery,
	onSearchChange,
	onExampleClick
}) => {
	const [statusFilter, setStatusFilter] = useState("all")
	const [dateFilter, setDateFilter] = useState("all")
	// New states for workflow view
	const [workflowStatusFilter, setWorkflowStatusFilter] = useState("all")
	const [workflowTypeFilter, setWorkflowTypeFilter] = useState("all")

	const { tasksToDisplay, workflowsToDisplay } = useMemo(() => {
		const taskTypes = ["long_form", "single", "swarm"]
		const workflowTypes = ["recurring", "triggered"]

		// 1. Nest sub-tasks first before any filtering
		const subTasksByParentId = new Map()
		const topLevelTasks = []

		tasks.forEach((task) => {
			const parentId = task.original_context?.parent_task_id
			if (parentId) {
				if (!subTasksByParentId.has(parentId)) {
					subTasksByParentId.set(parentId, [])
				}
				subTasksByParentId.get(parentId).push(task)
			} else {
				topLevelTasks.push(task)
			}
		})

		topLevelTasks.forEach((parent) => {
			if (subTasksByParentId.has(parent.task_id)) {
				parent.subTasks = subTasksByParentId
					.get(parent.task_id)
					.sort(
						(a, b) =>
							new Date(a.created_at) - new Date(b.created_at)
					)
			}
		})

		// 2. Apply filters to the nested list of top-level tasks
		let filtered = topLevelTasks

		// Status filter
		if (view === "tasks") {
			if (statusFilter !== "all") {
				const statusMap = {
					active: [
						"planning",
						"processing",
						"clarification_pending",
						"approval_pending",
						"waiting",
						"active",
						"clarification_answered"
					],
					completed: ["completed"],
					failed: ["error", "cancelled"]
				}
				const targetStatuses = statusMap[statusFilter]
				if (targetStatuses) {
					filtered = filtered.filter((task) =>
						targetStatuses.includes(task.status)
					)
				}
			}
		} else {
			// Workflow status filter
			if (workflowStatusFilter !== "all") {
				const statusMap = {
					active: ["active", "planning"],
					inactive: ["error", "cancelled", "archived"]
				}
				const targetStatuses = statusMap[workflowStatusFilter]
				if (targetStatuses) {
					filtered = filtered.filter((task) =>
						targetStatuses.includes(task.status)
					)
				}
			}
		}
		// Date filter
		if (dateFilter !== "all") {
			const now = new Date()
			filtered = filtered.filter((task) => {
				if (!task.created_at) return false
				const createdAt = new Date(task.created_at)
				if (dateFilter === "today") return isToday(createdAt)
				if (dateFilter === "this_week") {
					const start = startOfWeek(now, { weekStartsOn: 1 }) // Monday
					return isWithinInterval(createdAt, { start, end: now })
				}
				if (dateFilter === "this_month") {
					const start = startOfMonth(now)
					return isWithinInterval(createdAt, { start, end: now })
				}
				return true
			})
		}

		// Search query filter
		if (searchQuery) {
			filtered = filtered.filter(
				(task) =>
					(task.name || "")
						.toLowerCase()
						.includes(searchQuery.toLowerCase()) ||
					(task.description || "")
						.toLowerCase()
						.includes(searchQuery.toLowerCase())
			)
		}

		// 3. Split the *filtered* list into tasks and workflows

		let finalWorkflows = filtered.filter((t) =>
			workflowTypes.includes(t.task_type)
		)

		// Apply workflow-specific type filter
		if (workflowTypeFilter !== "all") {
			finalWorkflows = finalWorkflows.filter(
				(t) => t.task_type === workflowTypeFilter
			)
		}

		return {
			tasksToDisplay: filtered.filter((t) =>
				taskTypes.includes(t.task_type)
			),
			workflowsToDisplay: finalWorkflows
		}
	}, [
		tasks,
		searchQuery,
		statusFilter,
		dateFilter,
		view,
		workflowStatusFilter,
		workflowTypeFilter
	])

	const containerVariants = {
		hidden: { opacity: 1 }, // Let the parent control opacity
		visible: {
			transition: { staggerChildren: 0.07 }
		}
	}

	if (tasks.length === 0 && !searchQuery) {
		return (
			<WelcomePanel onExampleClick={onExampleClick} onClose={() => {}} />
		)
	}

	const FilterButton = ({ value, label, currentFilter, setFilter }) => (
		<button
			onClick={() => setFilter(value)}
			className={cn(
				"px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex-grow sm:flex-grow-0 text-center border",
				currentFilter === value
					? "bg-brand-orange text-brand-black border-brand-orange/50"
					: "bg-neutral-800/50 backdrop-blur-sm border-neutral-700/50 hover:bg-neutral-700/70 text-neutral-300"
			)}
		>
			{label}
		</button>
	)

	return (
		<div className="h-full space-y-4 rounded-xl bg-transparent">
			<div className="flex flex-col gap-4">
				<div className="relative">
					<IconSearch
						className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
						size={20}
					/>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Search tasks..."
						className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-neutral-500 focus:ring-2 focus:ring-brand-orange"
					/>
				</div>

				<AnimatePresence mode="wait">
					<motion.div
						key={view}
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2 }}
						className="flex flex-col gap-3"
					>
						{view === "tasks" ? (
							<>
								<div className="flex flex-wrap items-center gap-2">
									<IconFilter
										size={14}
										className="text-neutral-400"
									/>
									<span className="text-xs font-medium text-neutral-400 shrink-0">
										Status:
									</span>
									<FilterButton
										value="all"
										label="All"
										currentFilter={statusFilter}
										setFilter={setStatusFilter}
									/>
									<FilterButton
										value="active"
										label="Active"
										currentFilter={statusFilter}
										setFilter={setStatusFilter}
									/>
									<FilterButton
										value="completed"
										label="Completed"
										currentFilter={statusFilter}
										setFilter={setStatusFilter}
									/>
									<FilterButton
										value="failed"
										label="Failed"
										currentFilter={statusFilter}
										setFilter={setStatusFilter}
									/>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs font-medium text-neutral-400 shrink-0 ml-5">
										Date:
									</span>
									<FilterButton
										value="all"
										label="All Time"
										currentFilter={dateFilter}
										setFilter={setDateFilter}
									/>
									<FilterButton
										value="today"
										label="Today"
										currentFilter={dateFilter}
										setFilter={setDateFilter}
									/>
									<FilterButton
										value="this_week"
										label="This Week"
										currentFilter={dateFilter}
										setFilter={setDateFilter}
									/>
									<FilterButton
										value="this_month"
										label="This Month"
										currentFilter={dateFilter}
										setFilter={setDateFilter}
									/>
								</div>
							</>
						) : (
							<>
								<div className="flex flex-wrap items-center gap-2">
									<IconFilter
										size={14}
										className="text-neutral-400"
									/>
									<span className="text-xs font-medium text-neutral-400 shrink-0">
										Status:
									</span>
									<FilterButton
										value="all"
										label="All"
										currentFilter={workflowStatusFilter}
										setFilter={setWorkflowStatusFilter}
									/>
									<FilterButton
										value="active"
										label="Active"
										currentFilter={workflowStatusFilter}
										setFilter={setWorkflowStatusFilter}
									/>
									<FilterButton
										value="inactive"
										label="Inactive"
										currentFilter={workflowStatusFilter}
										setFilter={setWorkflowStatusFilter}
									/>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs font-medium text-neutral-400 shrink-0 ml-5">
										Type:
									</span>
									<FilterButton
										value="all"
										label="All"
										currentFilter={workflowTypeFilter}
										setFilter={setWorkflowTypeFilter}
									/>
									<FilterButton
										value="recurring"
										label="Recurring"
										currentFilter={workflowTypeFilter}
										setFilter={setWorkflowTypeFilter}
									/>
									<FilterButton
										value="triggered"
										label="Triggered"
										currentFilter={workflowTypeFilter}
										setFilter={setWorkflowTypeFilter}
									/>
								</div>
							</>
						)}
					</motion.div>
				</AnimatePresence>
			</div>

			<AnimatePresence>
				{view === "tasks" ? (
					<div>
						{tasksToDisplay.length > 0 ? (
							<motion.div
								className="space-y-3"
								variants={containerVariants}
								initial="hidden"
								animate="visible"
							>
								{tasksToDisplay.map((task) => (
									<TaskCardList
										key={task.task_id}
										task={task}
										onSelectTask={onSelectTask}
									/>
								))}
							</motion.div>
						) : (
							<p className="text-center text-neutral-500 pt-8">
								No tasks found.
							</p>
						)}
					</div>
				) : (
					<div>
						{workflowsToDisplay.length > 0 ? (
							<motion.div
								className="space-y-3"
								variants={containerVariants}
								initial="hidden"
								animate="visible"
							>
								{workflowsToDisplay.map((task) => (
									<TaskCardList
										key={task.task_id}
										task={task}
										onSelectTask={onSelectTask}
									/>
								))}
							</motion.div>
						) : (
							<p className="text-center text-neutral-500 pt-8">
								No workflows found.
							</p>
						)}
					</div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ListView
