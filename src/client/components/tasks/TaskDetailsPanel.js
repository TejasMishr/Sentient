"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
	IconX,
	IconPencil,
	IconTrash,
	IconRepeat,
	IconDeviceFloppy,
	IconSquareX,
	IconArchive,
	IconCircleCheck,
	IconPlayerPlay,
	IconPlayerPause,
	IconClock,
	IconClipboardList,
	IconUsersGroup,
	IconProgress,
	IconLoader
} from "@tabler/icons-react"
import { getDisplayName } from "@utils/taskUtils"
import RecurringTaskDetails from "./RecurringTaskDetails"
import ConnectToolButton from "./ConnectToolButton"
import { cn } from "@utils/cn"
import TaskDetailsContent from "./TaskDetailsContent"
import TriggeredTaskDetails from "./TriggeredTaskDetails"
import { Button } from "@components/ui/button"

const TaskDetailsPanel = ({
	task,
	allTools = [],
	integrations,
	onClose,
	onSave,
	onApprove,
	onDelete,
	onRerun,
	onArchiveTask,
	className,
	onSendChatMessage,
	onAnswerClarifications,
	onAnswerLongFormClarification,
	onSelectTask,
	onResumeTask,
	onPauseTask
}) => {
	const [isEditing, setIsEditing] = useState(false)
	const [editableTask, setEditableTask] = useState(task)
	const scheduleType = task?.schedule?.type
	const [userTimezone, setUserTimezone] = useState(null)

	const missingTools = useMemo(() => {
		if (!task || !integrations) {
			return []
		}

		let plan
		// For tasks pending approval, the top-level plan is the one that matters.
		if (task.status === "approval_pending" && task.plan) {
			plan = task.plan
		} else {
			// For other states, look at the latest run's plan for historical context.
			plan =
				task.runs && task.runs.length > 0
					? task.runs[task.runs.length - 1].plan
					: task.plan
		}

		if (!plan || !Array.isArray(plan) || plan.length === 0) {
			return []
		}

		// FIX: Filter out any null, undefined, or empty tool names from the plan
		// to prevent errors when rendering the missing tools buttons.
		const requiredTools = new Set(
			plan
				.map((step) => step.tool)
				.filter((tool) => tool && tool !== "general_instruction")
		)

		const connectedTools = new Set(
			integrations
				.filter((i) => i.connected || i.auth_type === "builtin")
				.map((i) => i.name)
		)

		const missing = []
		for (const tool of requiredTools) {
			if (!connectedTools.has(tool)) {
				const toolDetails = integrations.find((i) => i.name === tool)
				missing.push({
					name: tool,
					displayName: toolDetails?.display_name || tool
				})
			}
		}
		return missing
	}, [task, integrations])

	useEffect(() => {
		setEditableTask(task)
		if (!task) {
			setIsEditing(false) // Reset editing state when task is closed/changed
		}
	}, [task])

	useEffect(() => {
		const fetchUserTimezone = async () => {
			try {
				const response = await fetch("/api/user/data", {
					method: "POST"
				})
				if (!response.ok) throw new Error("Failed to fetch user data")
				const result = await response.json()
				const timezone = result?.data?.personalInfo?.timezone
				setUserTimezone(
					timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
				) // Fallback to browser timezone
			} catch (err) {
				console.error("Failed to fetch user timezone", err)
				setUserTimezone(
					Intl.DateTimeFormat().resolvedOptions().timeZone
				) // Fallback on error
			}
		}
		fetchUserTimezone()
	}, [])

	const handleStartEditing = () => {
		// Prioritize the current, top-level plan, especially for tasks pending approval.
		// Fall back to the latest run's plan only if the top-level one is empty.
		const latestRun =
			task.runs && task.runs.length > 0
				? task.runs[task.runs.length - 1]
				: null
		const planForEditing =
			task.plan && task.plan.length > 0
				? task.plan
				: latestRun?.plan || []

		setEditableTask({ ...task, plan: planForEditing })
		setIsEditing(true)
	}

	const handleFieldChange = (field, value) =>
		setEditableTask((prev) => ({ ...prev, [field]: value }))
	const handleScheduleChange = (newSchedule) =>
		setEditableTask((prev) => ({ ...prev, schedule: newSchedule }))
	const handleAddStep = () =>
		setEditableTask((prev) => ({
			...prev,
			plan: [...(prev.plan || []), { tool: "", description: "" }]
		}))
	const handleRemoveStep = (index) =>
		setEditableTask((prev) => ({
			...prev,
			plan: prev.plan.filter((_, i) => i !== index)
		}))
	const handleStepChange = (index, field, value) =>
		setEditableTask((prev) => ({
			...prev,
			plan: prev.plan.map((step, i) =>
				i === index ? { ...step, [field]: value } : step
			)
		}))
	const handleSaveEdit = () => {
		onSave(editableTask)
		setIsEditing(false)
	}

	const ActionButton = ({
		onClick,
		icon,
		children,
		className = "",
		disabled = false
	}) => (
		<Button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors",
				className
			)}
		>
			{icon}
			{children}
		</Button>
	)

	return (
		<aside
			className={cn(
				"w-full h-full bg-brand-black backdrop-blur-xl shadow-2xl md:border-l border-neutral-700/80 flex flex-col flex-shrink-0",
				className
			)}
			data-tour-id="task-details-panel"
		>
			{!task ? (
				<div className="flex flex-col items-center justify-center h-full text-center text-neutral-500 p-8">
					<IconClipboardList size={48} className="mb-4" />
					<h3 className="text-lg font-semibold text-neutral-400">
						Select a Task
					</h3>
					<p className="max-w-xs">
						Choose a task from the list to see its details, plan,
						and outcome here.
					</p>
				</div>
			) : (
				<>
					{/* --- HEADER --- */}
					<header className="flex items-start justify-between p-6 border-b border-neutral-700/50 flex-shrink-0">
						<div className="flex-1 pr-4">
							{isEditing ? (
								<input
									type="text"
									value={editableTask.description}
									onChange={(e) =>
										handleFieldChange(
											"description",
											e.target.value
										)
									}
									className="w-full bg-transparent text-2xl font-bold text-white focus:ring-0 focus:border-brand-orange border-b-2 border-transparent"
								/>
							) : (
								<h2 className="text-lg md:text-xl font-bold text-white leading-snug flex items-center gap-2">
									{task.task_type === "swarm" && (
										<span className="p-1.5 bg-blue-500/20 text-blue-300 rounded-md">
											<IconUsersGroup size={20} />
										</span>
									)}
									{task.task_type === "long_form" && (
										<span className="p-1.5 bg-purple-500/20 text-purple-300 rounded-md">
											<IconClock size={20} />
										</span>
									)}
									{getDisplayName(task)}
								</h2>
							)}
							{task.task_type === "swarm" && !isEditing && (
								<div className="mt-2">
									<div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
										<span>
											<IconProgress
												size={14}
												className="inline mr-1"
											/>
											Swarm Progress
										</span>
										<span>
											{task.swarm_details
												?.completed_agents || 0}
											/
											{task.swarm_details?.total_agents ||
												0}{" "}
											Agents
										</span>
									</div>
									<div className="w-full bg-neutral-700 rounded-full h-1.5">
										<div
											className="bg-brand-orange h-1.5 rounded-full"
											style={{
												width: `${((task.swarm_details?.completed_agents || 0) / (task.swarm_details?.total_agents || 1)) * 100}%`
											}}
										></div>
									</div>
								</div>
							)}
						</div>
						<button
							onClick={onClose}
							className="ml-4 p-2 rounded-full text-neutral-400 hover:bg-neutral-700 hover:text-white"
						>
							<IconX size={20} />
						</button>
					</header>

					{/* --- CONTENT --- */}
					<main className="flex-1 overflow-y-auto custom-scrollbar p-6">
						{!userTimezone && !isEditing ? (
							<div className="flex items-center justify-center h-full">
								<IconLoader className="w-6 h-6 animate-spin text-neutral-500" />
							</div>
						) : isEditing ? (
							<TaskDetailsContent // Use the one-time editor for all types for now
								task={task}
								isEditing={isEditing}
								editableTask={editableTask}
								handleFieldChange={handleFieldChange}
								handleScheduleChange={handleScheduleChange}
								handleAddStep={handleAddStep}
								handleRemoveStep={handleRemoveStep}
								handleStepChange={handleStepChange}
								allTools={allTools}
								integrations={integrations}
								userTimezone={userTimezone}
							/>
						) : scheduleType === "recurring" ? (
							<RecurringTaskDetails
								task={task}
								onAnswerClarifications={onAnswerClarifications}
								userTimezone={userTimezone}
							/>
						) : scheduleType === "triggered" ? (
							<TriggeredTaskDetails
								task={task}
								userTimezone={userTimezone}
							/>
						) : (
							<TaskDetailsContent
								task={task}
								onSendChatMessage={onSendChatMessage}
								onAnswerClarifications={onAnswerClarifications}
								onAnswerLongFormClarification={
									onAnswerLongFormClarification
								}
								userTimezone={userTimezone}
								onResumeTask={onResumeTask}
								onSelectTask={onSelectTask}
							/>
						)}
					</main>

					{/* --- FOOTER --- */}
					<footer className="p-4 border-t border-neutral-700/50 flex-shrink-0 bg-brand-gray/50">
						{isEditing ? (
							<>
								<div className="flex items-center gap-2">
									{/* Empty div for spacing */}
								</div>
								<div className="flex items-center gap-2">
									<Button
										onClick={() => setIsEditing(false)}
										variant="secondary"
									>
										<IconSquareX
											size={16}
											className="mr-2"
										/>
										Cancel
									</Button>
									<Button
										onClick={handleSaveEdit}
										className="bg-brand-orange text-brand-black font-semibold hover:bg-brand-orange/90"
									>
										<IconDeviceFloppy
											size={16}
											className="mr-2"
										/>
										Save
									</Button>
								</div>
							</>
						) : (
							<div className="flex flex-col gap-4">
								{/* Top section with minor actions and warnings */}
								<div className="flex justify-between items-start gap-2">
									<div className="flex items-center gap-2">
										<Button
											onClick={handleStartEditing}
											variant="ghost"
											size="sm"
											className="text-neutral-400"
										>
											<IconPencil
												size={16}
												className="mr-2"
											/>
											Edit
										</Button>
										<Button
											onClick={() =>
												onDelete(task.task_id)
											}
											variant="ghost"
											size="sm"
											className="text-neutral-400 hover:text-red-400"
										>
											<IconTrash
												size={16}
												className="mr-2"
											/>
											Delete
										</Button>
										<Button
											onClick={() =>
												onRerun(task.task_id)
											}
											variant="ghost"
											size="sm"
											className="text-neutral-400"
										>
											<IconRepeat
												size={16}
												className="mr-2"
											/>
											Rerun
										</Button>
									</div>
									{missingTools.length > 0 && (
										<div className="text-xs text-red-400 flex flex-col items-end gap-1 text-right flex-shrink min-w-0">
											<span>
												Connect tools to approve:
											</span>
											<div className="flex gap-2 flex-wrap justify-end">
												{missingTools.map((tool) => (
													<ConnectToolButton
														key={tool.name}
														toolName={
															tool.displayName
														}
													/>
												))}
											</div>
										</div>
									)}
								</div>

								{/* Main action buttons */}
								<div className="flex flex-col sm:flex-row gap-2 w-full">
									{task.status === "approval_pending" && (
										<Button
											onClick={() =>
												onApprove(task.task_id)
											}
											className="bg-green-600 text-white hover:bg-green-500 w-full sm:w-auto flex-grow justify-center"
											disabled={missingTools.length > 0}
										>
											<IconCircleCheck
												size={16}
												className="mr-2"
											/>
											Approve & Run
										</Button>
									)}
									{task.task_type === "long_form" &&
										task.orchestrator_state
											?.current_state === "WAITING" && (
											<Button
												onClick={() =>
													onResumeTask(task.task_id)
												}
												className="bg-blue-600 text-white hover:bg-blue-500 w-full sm:w-auto flex-grow justify-center"
											>
												<IconPlayerPlay
													size={16}
													className="mr-2"
												/>
												Resume Now
											</Button>
										)}
									{task.task_type === "long_form" &&
										task.orchestrator_state
											?.current_state === "ACTIVE" && (
											<Button
												onClick={() =>
													onPauseTask(task.task_id)
												}
												className="bg-yellow-600 text-white hover:bg-yellow-500 w-full sm:w-auto flex-grow justify-center"
											>
												<IconPlayerPause
													size={16}
													className="mr-2"
												/>
												Pause
											</Button>
										)}
									<Button
										onClick={() =>
											onArchiveTask(task.task_id)
										}
										variant="secondary"
										className="w-full sm:w-auto justify-center"
									>
										<IconArchive
											size={16}
											className="mr-2"
										/>
										Archive
									</Button>
								</div>
							</div>
						)}
					</footer>
				</>
			)}
		</aside>
	)
}

export default TaskDetailsPanel
