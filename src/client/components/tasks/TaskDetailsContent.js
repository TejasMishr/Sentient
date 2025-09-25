"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import toast from "react-hot-toast"
import { cn } from "@utils/cn"
import { taskStatusColors, priorityMap } from "./constants"
import {
	IconGripVertical,
	IconPlus,
	IconX,
	IconLoader,
	IconSend,
	IconInfoCircle,
	IconChevronRight,
	IconClock,
	IconTool,
	IconFileText,
	IconLink,
	IconCheck,
	IconChevronDown,
	IconPlayerPlay
} from "@tabler/icons-react"
import ScheduleEditor from "./ScheduleEditor"
import ChatBubble from "@components/chat/ChatBubble"
import ReactMarkdown from "react-markdown"
import ExecutionUpdate from "./ExecutionUpdate"
import { TextShimmer } from "@components/ui/text-shimmer"
import { motion, AnimatePresence } from "framer-motion"
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "@components/ui/accordion"
import { Textarea } from "@components/ui/textarea"
import { Select } from "@components/ui/select"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"

// --- NEW COMPONENT: WaitingStateDisplay (integrated into flowchart node) ---
const WaitingNodeDetails = ({
	waitingConfig,
	onResumeTask,
	taskId,
	userTimezone
}) => {
	if (!waitingConfig || !waitingConfig.timeout_at) return null

	const [timeLeft, setTimeLeft] = useState("Calculating...")
	const timeoutDate = useMemo(() => {
		const timeoutVal = waitingConfig.timeout_at
		let dateString = timeoutVal

		// Case 1: It's already a valid Date object
		if (timeoutVal instanceof Date && !isNaN(timeoutVal)) {
			return timeoutVal
		}

		// Case 2: It's the MongoDB extended JSON object
		if (
			typeof timeoutVal === "object" &&
			timeoutVal !== null &&
			"$date" in timeoutVal
		) {
			dateString = timeoutVal.$date
		}

		// Case 3: It's a string. Parse it robustly to avoid ambiguity.
		if (typeof dateString === "string") {
			const match = dateString.match(
				/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/
			)

			if (match) {
				const year = parseInt(match[1], 10)
				const month = parseInt(match[2], 10) // Note: 1-12
				const day = parseInt(match[3], 10)
				const hours = parseInt(match[4], 10)
				const minutes = parseInt(match[5], 10)
				const seconds = parseInt(match[6], 10)
				const ms = match[7] ? parseInt(match[7].padEnd(3, "0"), 10) : 0

				// Date.UTC() requires month to be 0-indexed (0-11)
				const utcTimestamp = Date.UTC(
					year,
					month - 1,
					day,
					hours,
					minutes,
					seconds,
					ms
				)
				return new Date(utcTimestamp)
			}
		}

		console.error(
			"Invalid or unparsable date format for timeout:",
			timeoutVal
		)
		return null
	}, [waitingConfig.timeout_at])

	if (!timeoutDate) return null

	const formattedTimeout = useMemo(() => {
		if (!timeoutDate) return "Invalid date"
		return new Intl.DateTimeFormat(undefined, {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			timeZoneName: "short",
			timeZone: userTimezone
		}).format(timeoutDate)
	}, [timeoutDate, userTimezone])

	useEffect(() => {
		if (!timeoutDate) {
			setTimeLeft("Invalid timeout date.")
			return
		}
		const intervalId = setInterval(() => {
			const now = new Date()
			const diff = timeoutDate.getTime() - now.getTime()

			if (diff <= 0) {
				setTimeLeft(
					"Timeout reached. The orchestrator will check for updates on its next cycle."
				)
				clearInterval(intervalId)
				return
			}

			const hours = Math.floor(diff / (1000 * 60 * 60))
			const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
			const seconds = Math.floor((diff % (1000 * 60)) / 1000)

			setTimeLeft(
				`${String(hours).padStart(2, "0")}h ${String(minutes).padStart(
					2,
					"0"
				)}m ${String(seconds).padStart(2, "0")}s`
			)
		}, 1000)

		return () => clearInterval(intervalId)
	}, [timeoutDate])

	return (
		<div className="space-y-2">
			<p>
				Waiting for:{" "}
				<span className="font-semibold">
					{waitingConfig.waiting_for}
				</span>
			</p>
			<p className="text-xs text-neutral-400 italic">
				(Resumes after {formattedTimeout})
			</p>
			<p>
				Time remaining:{" "}
				<span className="font-mono font-semibold">{timeLeft}</span>
			</p>
			<Button
				onClick={() => onResumeTask(taskId)}
				className="mt-2 gap-2 bg-blue-600 hover:bg-blue-500"
				size="sm"
			>
				<IconPlayerPlay size={16} />
				Resume Now
			</Button>
		</div>
	)
}

// --- NEW COMPONENT: TaskFlowchartNode ---
const TaskFlowchartNode = ({
	node,
	onSelectTask,
	onResumeTask,
	userTimezone
}) => {
	const [isExpanded, setIsExpanded] = useState(false)

	const nodeIcons = {
		SUBTASK: <IconTool size={18} />,
		WAIT: <IconClock size={18} />,
		CLARIFICATION: <IconInfoCircle size={18} />,
		COMPLETED: <IconCheck size={18} />,
		FAILED: <IconX size={18} />
	}

	const nodeColors = {
		SUBTASK: "border-blue-500/50 text-blue-300",
		WAIT: "border-yellow-500/50 text-yellow-300",
		CLARIFICATION: "border-orange-500/50 text-orange-300",
		COMPLETED: "border-green-500/50 text-green-300",
		FAILED: "border-red-500/50 text-red-300"
	}

	const isClickable =
		node.data &&
		(node.data.sub_task_id || node.data.result || node.type === "WAIT")

	return (
		<div className="flex items-start">
			<div className="flex flex-col items-center mr-4">
				<div
					className={cn(
						"w-10 h-10 rounded-full flex items-center justify-center border-2 bg-neutral-900",
						nodeColors[node.type]
					)}
				>
					{nodeIcons[node.type]}
				</div>
				{!node.isLast && (
					<div className="w-0.5 h-12 bg-neutral-700 mt-2"></div>
				)}
			</div>
			<div className="flex-1 pb-10">
				<div
					className={cn(
						"p-3 rounded-lg border bg-neutral-800/50",
						nodeColors[node.type],
						isClickable && "cursor-pointer hover:bg-neutral-800"
					)}
					onClick={() => isClickable && setIsExpanded(!isExpanded)}
				>
					<div className="flex justify-between items-center">
						<div className="flex-1">
							<p className="font-semibold text-sm">
								{node.title}
							</p>
							<p className="text-xs text-neutral-400 capitalize mt-0.5">
								{node.status}
							</p>
						</div>
						{isClickable &&
							(isExpanded ? (
								<IconChevronDown size={16} />
							) : (
								<IconChevronRight size={16} />
							))}
					</div>
				</div>
				<AnimatePresence>
					{isExpanded && node.data && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="mt-2 p-3 bg-neutral-900 rounded-lg text-sm border border-neutral-800"
						>
							{node.type === "SUBTASK" &&
								node.data.sub_task_id && (
									<button
										onClick={() =>
											onSelectTask({
												task_id: node.data.sub_task_id
											})
										}
										className="text-blue-400 hover:underline flex items-center gap-1 w-full text-left"
									>
										View Sub-task Details{" "}
										<IconChevronRight size={14} />
									</button>
								)}
							{node.type === "WAIT" && (
								<WaitingNodeDetails
									waitingConfig={node.data.waiting_config}
									onResumeTask={onResumeTask}
									taskId={node.data.task_id}
									userTimezone={userTimezone}
								/>
							)}
							{node.type === "SUBTASK" && node.data.result && (
								<div>
									<p className="font-semibold text-neutral-300 mb-1">
										Result:
									</p>
									<pre className="text-xs bg-neutral-800 p-2 rounded-md whitespace-pre-wrap max-h-40 overflow-auto custom-scrollbar">
										{JSON.stringify(
											node.data.result,
											null,
											2
										)}
									</pre>
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	)
}

// --- NEW COMPONENT: TaskFlowchart ---
const TaskFlowchart = ({ task, onSelectTask, onResumeTask, userTimezone }) => {
	const { dynamic_plan = [], orchestrator_state = {}, status } = task
	const { current_state, waiting_config } = orchestrator_state

	const flowNodes = dynamic_plan.map((step) => ({
		type: "SUBTASK",
		title: step.description,
		status: step.status,
		data: step
	}))

	if (current_state === "WAITING" && waiting_config) {
		flowNodes.push({
			type: "WAIT",
			title: `Waiting...`,
			status: "Active",
			data: { waiting_config, task_id: task.task_id }
		})
	}

	if (current_state === "SUSPENDED") {
		const pendingRequest = (task.clarification_requests || []).find(
			(r) => r.status === "pending"
		)
		flowNodes.push({
			type: "CLARIFICATION",
			title: pendingRequest
				? `Awaiting user input`
				: "Awaiting user input",
			status: "Pending",
			data: null
		})
	}

	if (status === "completed" || current_state === "COMPLETED") {
		flowNodes.push({
			type: "COMPLETED",
			title: "Task Completed",
			status: "Completed",
			data: null
		})
	}

	if (status === "error" || current_state === "FAILED") {
		flowNodes.push({
			type: "FAILED",
			title: "Task Failed",
			status: "Failed",
			data: null
		})
	}

	if (flowNodes.length === 0 && status === "processing") {
		return (
			<div className="flex items-center gap-2 text-neutral-400">
				<IconLoader className="animate-spin" />
				<p>Orchestrator is generating the initial plan...</p>
			</div>
		)
	}

	return (
		<div>
			<h4 className="font-semibold text-neutral-300 mb-4">Task Flow</h4>
			<div className="relative">
				{flowNodes.map((node, index) => (
					<TaskFlowchartNode
						key={node.data?.step_id || index}
						node={{
							...node,
							isLast: index === flowNodes.length - 1
						}}
						onSelectTask={onSelectTask}
						onResumeTask={onResumeTask}
						userTimezone={userTimezone}
					/>
				))}
			</div>
		</div>
	)
}

// --- NEW COMPONENT: Replaces the old simple TaskResultDisplay ---
const FileCard = ({ file }) => (
	<a
		href={file.file_url}
		target="_blank"
		rel="noopener noreferrer"
		className="flex items-center gap-3 p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50 hover:border-brand-orange/50 transition-colors"
	>
		<IconFileText size={20} className="text-neutral-400 flex-shrink-0" />
		<div className="overflow-hidden">
			<p className="text-sm font-medium text-neutral-200 truncate">
				{file.file_name}
			</p>
			{file.description && (
				<p className="text-xs text-neutral-500 truncate">
					{file.description}
				</p>
			)}
		</div>
	</a>
)

// Helper component to display task results
const TaskResultDisplay = ({ result }) => {
	if (!result) return null

	let parsedResult
	if (typeof result === "string") {
		try {
			parsedResult = JSON.parse(result)
		} catch (e) {
			parsedResult = null // It's not a valid JSON string
		}
	} else {
		parsedResult = result
	}

	if (typeof parsedResult !== "object" || parsedResult === null) {
		// Fallback for plain text results
		return (
			<div>
				<h4 className="font-semibold text-neutral-300 mb-2">Result</h4>
				<p className="text-sm bg-neutral-800/50 p-3 rounded-lg text-neutral-300 whitespace-pre-wrap border border-neutral-700/50">
					{String(result)}
				</p>
			</div>
		)
	}

	const {
		summary,
		links_created = [],
		links_found = [],
		files_created = [],
		tools_used = []
	} = parsedResult
	const allLinks = [...links_created, ...links_found]

	return (
		<div className="space-y-6">
			{summary && (
				<div>
					<h4 className="font-semibold text-neutral-300 mb-2">
						Summary
					</h4>
					<div className="prose prose-sm prose-invert text-neutral-300 bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50">
						<ReactMarkdown>{summary}</ReactMarkdown>
					</div>
				</div>
			)}
			{files_created.length > 0 && (
				<div>
					<h4 className="font-semibold text-neutral-300 mb-2">
						Files Created
					</h4>
					<div className="space-y-2">
						{files_created.map((file, index) => (
							<FileCard key={index} file={file} />
						))}
					</div>
				</div>
			)}
			{allLinks.length > 0 && (
				<div>
					<h4 className="font-semibold text-neutral-300 mb-2">
						Links
					</h4>
					<div className="space-y-2">
						{allLinks.map((link, index) => (
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								key={index}
								className="flex items-start gap-3 p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50 hover:border-brand-orange/50 transition-colors"
							>
								<IconLink
									size={16}
									className="text-neutral-400 flex-shrink-0 mt-1"
								/>
								<div className="overflow-hidden">
									<p className="text-sm font-medium text-blue-400 truncate">
										{link.url}
									</p>
									{link.description && (
										<p className="text-xs text-neutral-500">
											{link.description}
										</p>
									)}
								</div>
							</a>
						))}
					</div>
				</div>
			)}
			{tools_used.length > 0 && (
				<div>
					<h4 className="font-semibold text-neutral-300 mb-2">
						Tools Used
					</h4>
					<div className="flex flex-wrap gap-2">
						{tools_used.map((tool, index) => (
							<div
								key={index}
								className="flex items-center gap-1.5 bg-neutral-800 text-neutral-300 text-xs font-medium px-2 py-1 rounded-full border border-neutral-700"
							>
								<IconTool size={12} />
								{tool}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// New component for handling clarification questions
const QnaSection = ({ questions, task, onAnswerClarifications }) => {
	const [answers, setAnswers] = useState({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const isInputMode = task.status === "clarification_pending"

	const handleAnswerChange = (questionId, text) => {
		setAnswers((prev) => ({ ...prev, [questionId]: text }))
	}

	const handleSubmit = async () => {
		const unansweredQuestions = questions.filter(
			(q) => !answers[q.question_id]?.trim()
		)
		if (unansweredQuestions.length > 0) {
			toast.error("Please answer all questions before submitting.")
			return
		}

		setIsSubmitting(true)
		const answersPayload = Object.entries(answers).map(
			([question_id, answer_text]) => ({
				question_id,
				answer_text
			})
		)
		// This function is passed down from the main page and includes closing the panel
		await onAnswerClarifications(task.task_id, answersPayload)
		setIsSubmitting(false) // This might not be reached if the component unmounts
	}

	return (
		<div>
			<h4 className="font-semibold text-neutral-300 mb-2">
				Clarifying Questions
			</h4>
			<div
				className={cn(
					"space-y-4 p-4 rounded-lg border",
					isInputMode
						? "bg-yellow-500/10 border-yellow-500/20"
						: "bg-neutral-800/20 border-neutral-700/50"
				)}
			>
				{questions.map((q, index) => (
					<div key={q.question_id || index}>
						<label className="block text-sm font-medium text-neutral-300 mb-2">
							{q.text}
						</label>
						{isInputMode ? (
							<Textarea
								value={answers[q.question_id] || ""}
								onChange={(e) =>
									handleAnswerChange(
										q.question_id,
										e.target.value
									)
								}
								rows={2}
								placeholder="Your answer..."
							/>
						) : (
							<p className="text-sm text-neutral-100 p-2 bg-neutral-900/50 rounded-md whitespace-pre-wrap">
								{q.answer || (
									<span className="italic text-neutral-500">
										No answer provided.
									</span>
								)}
							</p>
						)}
					</div>
				))}
				{isInputMode && (
					<div className="flex justify-end">
						<Button
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="gap-2 bg-yellow-400 text-black hover:bg-yellow-300"
							size="sm"
						>
							{isSubmitting && (
								<IconLoader
									size={16}
									className="animate-spin"
								/>
							)}
							{isSubmitting ? "Submitting..." : "Submit Answers"}
						</Button>
					</div>
				)}
			</div>
		</div>
	)
}

const LongFormPlanSection = ({ plan, onSelectTask }) => {
	if (!plan || plan.length === 0) {
		return (
			<div>
				<h4 className="font-semibold text-neutral-300 mb-2">Plan</h4>
				<p className="text-sm text-neutral-500">
					The orchestrator is currently generating the initial plan.
				</p>
			</div>
		)
	}

	return (
		<div>
			<h4 className="font-semibold text-neutral-300 mb-2">
				Dynamic Plan
			</h4>
			<div className="space-y-3">
				{plan.map((step, index) => (
					<div
						key={step.step_id || index}
						className="p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50"
					>
						<p className="text-sm font-medium text-neutral-200">
							{step.description}
						</p>
						<div className="text-xs text-neutral-400 mt-2 flex items-center justify-between">
							<span>
								Status:{" "}
								<span className="font-semibold capitalize">
									{step.status}
								</span>
							</span>
							{step.sub_task_id && (
								<button
									onClick={() =>
										onSelectTask({
											task_id: step.sub_task_id
										})
									}
									className="text-blue-400 hover:underline flex items-center gap-1"
								>
									View Sub-task <IconChevronRight size={14} />
								</button>
							)}
						</div>
						{step.result && (
							<div className="mt-2 pt-2 border-t border-neutral-700">
								<p className="text-xs font-semibold text-neutral-300 mb-1">
									Result:
								</p>
								<pre className="text-xs bg-neutral-900 p-2 rounded-md whitespace-pre-wrap max-h-40 overflow-auto custom-scrollbar">
									{JSON.stringify(step.result, null, 2)}
								</pre>
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	)
}

const LongFormQnaSection = ({ requests, task, onAnswer }) => {
	const [answers, setAnswers] = useState({})
	const [isSubmitting, setIsSubmitting] = useState(null) // store request_id being submitted

	const pendingRequests = requests.filter((r) => r.status === "pending")
	if (pendingRequests.length === 0) return null

	const handleAnswerChange = (requestId, text) => {
		setAnswers((prev) => ({ ...prev, [requestId]: text }))
	}

	const handleSubmit = async (requestId) => {
		const answerText = answers[requestId]
		if (!answerText || !answerText.trim()) {
			toast.error("Please provide an answer.")
			return
		}
		setIsSubmitting(requestId)
		await onAnswer(task.task_id, requestId, answerText)
		setIsSubmitting(null)
	}

	return (
		<div>
			<h4 className="font-semibold text-neutral-300 mb-2">
				Action Required
			</h4>
			<div className="space-y-4 p-4 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
				{pendingRequests.map((req) => (
					<div key={req.request_id}>
						<label className="block text-sm font-medium text-neutral-300 mb-2 whitespace-pre-wrap">
							{req.question}
						</label>
						<Textarea
							value={answers[req.request_id] || ""}
							onChange={(e) =>
								handleAnswerChange(
									req.request_id,
									e.target.value
								)
							}
							rows={3}
							placeholder="Your answer..."
						/>
						<div className="flex justify-end mt-2">
							<Button
								onClick={() => handleSubmit(req.request_id)}
								disabled={isSubmitting === req.request_id}
								className="gap-2 bg-yellow-400 text-black hover:bg-yellow-300"
								size="sm"
							>
								{isSubmitting === req.request_id && (
									<IconLoader
										size={16}
										className="animate-spin"
									/>
								)}
								{isSubmitting === req.request_id
									? "Submitting..."
									: "Submit Answer"}
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

const SwarmPlanSection = ({ plan }) => {
	if (!plan || plan.length === 0) return null

	return (
		<div>
			<h4 className="font-semibold text-neutral-300 mb-2">
				Swarm Execution Plan
			</h4>
			<div className="space-y-3">
				{plan.map((workerConfig, index) => (
					<div
						key={index}
						className="p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50"
					>
						<p className="text-sm font-semibold text-neutral-200 mb-2">
							Worker Group #{index + 1} (
							{workerConfig.item_indices?.length || 0} items)
						</p>
						<div>
							<label className="text-xs text-neutral-400">
								Instructions:
							</label>
							<p className="text-sm text-neutral-300 mt-1 italic">
								"{workerConfig.worker_prompt}"
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

const CurrentPlanSection = ({ task }) => {
	// This section shows the plan that is currently pending approval or being planned.
	if (
		!["approval_pending", "planning"].includes(task.status) ||
		!task.plan ||
		task.plan.length === 0
	) {
		return null
	}

	const isChangeRequest = task.chat_history && task.chat_history.length > 0
	const lastRequest = isChangeRequest
		? task.chat_history[task.chat_history.length - 1]
		: null

	return (
		<div
			className={cn(
				"space-y-4 p-4 rounded-lg border",
				isChangeRequest
					? "bg-blue-500/10 border-blue-500/20"
					: "bg-neutral-800/30 border-neutral-700/50"
			)}
		>
			<h4
				className={cn(
					"font-semibold mb-2",
					isChangeRequest ? "text-blue-300" : "text-neutral-300"
				)}
			>
				{isChangeRequest
					? "Change Request: Plan Pending Approval"
					: "Plan Pending Approval"}
			</h4>

			{lastRequest && (
				<div>
					<label className="text-sm font-medium text-neutral-400 block mb-2">
						Your Request
					</label>
					<div className="bg-neutral-800/50 p-3 rounded-lg text-sm text-neutral-300 italic">
						"{lastRequest.content}"
					</div>
				</div>
			)}

			<div className="space-y-2">
				{task.plan.map((step, index) => (
					<div
						key={index}
						className="flex items-start gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700/50"
					>
						<div className="flex-shrink-0 w-5 h-5 bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold">
							{index + 1}
						</div>
						<div>
							<p className="text-sm font-medium text-neutral-100">
								{step.tool}
							</p>
							<p className="text-sm text-neutral-400">
								{step.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

const TaskChatSection = ({ task, onSendChatMessage }) => {
	const [message, setMessage] = useState("")
	const chatEndRef = useRef(null)
	const chatHistory = useMemo(
		() => task.chat_history || [],
		[task.chat_history]
	)

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [chatHistory])

	const handleSend = () => {
		if (message.trim()) {
			onSendChatMessage(task.task_id, message)
			setMessage("")
		}
	}

	return (
		<div className="mt-6 pt-6 border-t border-neutral-800">
			<h4 className="font-semibold text-neutral-300 mb-4">
				Request Changes
			</h4>
			<div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
				{chatHistory.map((msg, index) => (
					<ChatBubble
						key={index}
						role={msg.role}
						turn_steps={msg.turn_steps || []}
						content={msg.content}
						message={msg}
						allMessages={chatHistory}
					/>
				))}
				<div ref={chatEndRef} />
			</div>
			<div className="mt-4 flex items-center gap-2">
				<input
					type="text"
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSend()}
					placeholder="Describe the changes you need..."
					className="flex-grow p-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm"
				/>
				<Button
					onClick={handleSend}
					className="bg-blue-600 hover:bg-blue-500"
					size="icon"
					disabled={!message.trim()}
				>
					<IconSend size={16} />
				</Button>
			</div>
		</div>
	)
}

const TaskDetailsContent = ({
	task,
	isEditing,
	editableTask,
	handleFieldChange,
	handleScheduleChange,
	handleAddStep,
	handleRemoveStep,
	handleStepChange,
	allTools,
	integrations,
	userTimezone,
	onSendChatMessage,
	onAnswerClarifications,
	onAnswerLongFormClarification,
	onSelectTask,
	onResumeTask
}) => {
	if (!task) {
		return null
	}

	const displayTask = isEditing ? editableTask : task
	const statusInfo =
		taskStatusColors[displayTask.status] || taskStatusColors.default
	const orchestratorStatus =
		displayTask.task_type === "long_form"
			? displayTask.orchestrator_state?.current_state
			: null
	const priorityInfo =
		priorityMap[displayTask.priority] || priorityMap.default
	const runs = displayTask.runs || []
	const latestRun = runs.length > 0 ? runs[runs.length - 1] : null
	const isSubtask = !!displayTask.original_context?.parent_task_id

	// Handle the special case of a re-run subtask pending approval
	if (isSubtask && !isEditing && displayTask.status === "approval_pending") {
		return (
			<div className="space-y-6">
				{/* Show context from the last run before this new plan */}
				{latestRun?.result && (
					<Accordion type="single" collapsible defaultValue="item-1">
						<AccordionItem value="item-1">
							<AccordionTrigger>
								Context from Previous Run
							</AccordionTrigger>
							<AccordionContent>
								<TaskResultDisplay result={latestRun.result} />
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				)}
				{/* Show the new plan that needs approval */}
				<CurrentPlanSection task={displayTask} />
			</div>
		)
	}

	// Handle all other subtask states (completed, processing, etc.)
	if (isSubtask && !isEditing) {
		return (
			<div className="space-y-6">
				{displayTask.error && (
					<div>
						<h4 className="font-semibold text-red-400 mb-2">
							Sub-task Error
						</h4>
						<p className="text-sm bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-lg whitespace-pre-wrap">
							{displayTask.error}
						</p>
					</div>
				)}
				{latestRun?.result && (
					<TaskResultDisplay result={latestRun.result} />
				)}
				<div>
					<label className="text-sm font-medium text-neutral-400 block mb-2">
						Description
					</label>
					<div className="bg-neutral-800/50 p-3 rounded-lg text-sm text-neutral-300 whitespace-pre-wrap">
						{displayTask.description || "No description provided."}
					</div>
				</div>
				{latestRun?.progress_updates?.length > 0 && (
					<Accordion type="single" collapsible>
						<AccordionItem value="item-1">
							<AccordionTrigger>
								Execution Log (Advanced)
							</AccordionTrigger>
							<AccordionContent>
								<div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-700/50 space-y-4">
									{latestRun.progress_updates.map(
										(update, index) => (
											<ExecutionUpdate
												key={index}
												update={update}
											/>
										)
									)}
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				)}
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{displayTask.error && (
				<div>
					<h4 className="font-semibold text-red-400 mb-2">
						Task Error
					</h4>
					<p className="text-sm bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-lg whitespace-pre-wrap">
						{displayTask.error}
					</p>
				</div>
			)}

			{displayTask.task_type === "long_form" && (
				<TaskFlowchart
					task={displayTask}
					onSelectTask={onSelectTask}
					onResumeTask={onResumeTask}
					userTimezone={userTimezone}
				/>
			)}
			{displayTask.task_type === "long_form" &&
				displayTask.orchestrator_state?.current_state === "SUSPENDED" &&
				displayTask.clarification_requests?.some(
					(r) => r.status === "pending"
				) && (
					<LongFormQnaSection
						requests={displayTask.clarification_requests}
						task={displayTask}
						onAnswer={onAnswerLongFormClarification} // new prop
					/>
				)}

			{displayTask.clarifying_questions &&
				displayTask.clarifying_questions.length > 0 && (
					<QnaSection
						questions={displayTask.clarifying_questions}
						task={displayTask}
						onAnswerClarifications={onAnswerClarifications}
					/>
				)}
			{/* --- SWARM DETAILS (not in edit mode) --- */}
			{displayTask.task_type === "swarm" && (
				<div>
					<h4 className="font-semibold text-neutral-300 mb-2">
						Swarm Details
					</h4>
					<div className="bg-neutral-800/50 p-3 rounded-lg text-sm text-neutral-300 space-y-2 border border-neutral-700/50">
						<p>
							<span className="font-semibold">Goal:</span>{" "}
							{displayTask.swarm_details?.goal}
						</p>
						<p>
							<span className="font-semibold">
								Items to process:
							</span>{" "}
							{displayTask.swarm_details?.items?.length || 0}
						</p>
					</div>
				</div>
			)}

			{/* --- META INFO & ASSIGNEE --- */}
			{/* This section is relevant for all task types */}
			<div className="w-full">
				<div>
					<label className="text-sm font-medium text-neutral-400 block mb-2">
						Meta
					</label>
					<div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm bg-neutral-800/50 p-3 rounded-lg">
						<span className="text-sm text-neutral-400">
							Status:
						</span>
						<span
							className={cn(
								"font-semibold py-0.5 px-2 rounded-full text-xs flex items-center gap-1",
								statusInfo.color,
								statusInfo.border.replace("border-", "bg-") +
									"/20"
							)}
						>
							<statusInfo.icon size={12} />
							{statusInfo.label}
							{orchestratorStatus && (
								<span className="text-neutral-500 font-normal italic">
									({orchestratorStatus})
								</span>
							)}
						</span>
						<div className="w-px h-4 bg-neutral-700"></div>
						<span className="text-sm text-neutral-400">
							Priority:
						</span>
						{isEditing ? (
							<Select
								value={editableTask.priority}
								onChange={(e) =>
									handleFieldChange(
										"priority",
										Number(e.target.value)
									)
								}
								className="px-2 py-1 text-xs h-auto"
							>
								<option value={0}>High</option>
								<option value={1}>Medium</option>
								<option value={2}>Low</option>
							</Select>
						) : (
							<span
								className={cn(
									"font-semibold",
									priorityInfo.color
								)}
							>
								{priorityInfo.label}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* --- DESCRIPTION --- */}
			<div>
				<label className="text-sm font-medium text-neutral-400 block mb-2">
					Description
				</label>
				{isEditing ? (
					<Textarea
						value={editableTask.description}
						onChange={(e) =>
							handleFieldChange("description", e.target.value)
						}
						rows={4}
						placeholder="Detailed task description..."
					/>
				) : (
					<div className="bg-neutral-800/50 p-3 rounded-lg text-sm text-neutral-300 whitespace-pre-wrap">
						{displayTask.description || "No description provided."}
					</div>
				)}
			</div>

			{/* --- SCHEDULE --- */}
			<div>
				<label className="text-sm font-medium text-neutral-400 block mb-2">
					Schedule
				</label>
				{isEditing ? (
					<ScheduleEditor
						schedule={
							editableTask.schedule || {
								type: "once",
								run_at: null
							}
						}
						setSchedule={handleScheduleChange}
					/>
				) : displayTask.schedule ? (
					<div className="bg-neutral-800/50 p-3 rounded-lg text-sm">
						{displayTask.schedule.type === "recurring"
							? `Recurring: ${displayTask.schedule.frequency} on ${displayTask.schedule.days?.join(", ")} at ${displayTask.schedule.time}`
							: `Once: ${displayTask.schedule.run_at ? new Date(displayTask.schedule.run_at).toLocaleString() : "ASAP"}`}
					</div>
				) : (
					<p className="text-sm text-neutral-500">Not scheduled.</p>
				)}
			</div>

			{/* --- PLAN & OUTCOME --- */}
			{isEditing ? ( // --- EDITING VIEW ---
				<div className="space-y-4 p-4 rounded-xl bg-neutral-900/60 backdrop-blur-sm border border-neutral-700/50">
					<h4 className="text-base font-semibold text-white">
						Edit Plan
					</h4>
					{(editableTask.plan || []).map((step, index) => (
						<div
							key={index}
							className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg"
						>
							<IconGripVertical className="h-5 w-5 text-neutral-500 cursor-grab flex-shrink-0" />
							<Select
								value={step.tool}
								onChange={(e) =>
									handleStepChange(
										index,
										"tool",
										e.target.value
									)
								}
								className="w-1/3 p-2.5 h-auto"
							>
								<option value="">Select tool...</option>
								{allTools.map((tool) => (
									<option key={tool.name} value={tool.name}>
										{tool.display_name}
									</option>
								))}
							</Select>
							<Input
								type="text"
								value={step.description}
								onChange={(e) =>
									handleStepChange(
										index,
										"description",
										e.target.value
									)
								}
								className="flex-grow p-2.5 h-auto"
								placeholder="Step description..."
							/>
							<button
								onClick={() => handleRemoveStep(index)}
								className="p-2 text-red-400 hover:bg-red-500/20 rounded-full flex-shrink-0"
							>
								<IconX size={16} />
							</button>
						</div>
					))}
					<button
						onClick={handleAddStep}
						className="flex items-center gap-1.5 text-sm py-2 px-4 rounded-lg bg-neutral-700 hover:bg-neutral-600 font-medium"
					>
						<IconPlus size={14} /> Add Step
					</button>
				</div>
			) : (
				// --- DISPLAY VIEW ---
				<>
					<CurrentPlanSection task={displayTask} />

					{/* --- NEW: Show previous result if re-planning, collapsed by default --- */}
					{displayTask.status === "approval_pending" &&
						latestRun?.result && (
							<Accordion type="single" collapsible>
								<AccordionItem value="item-1">
									<AccordionTrigger>
										Context from Previous Run
									</AccordionTrigger>
									<AccordionContent>
										<TaskResultDisplay
											result={latestRun.result}
										/>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						)}

					{runs.length > 0 && (
						<Accordion
							type="single"
							collapsible
							defaultValue={
								displayTask.status !== "approval_pending"
									? "run-history"
									: undefined
							}
						>
							<AccordionItem value="run-history">
								<AccordionTrigger>
									Full Run History
								</AccordionTrigger>
								<AccordionContent>
									{runs
										.slice()
										.reverse()
										.map(
											(
												run,
												index // Show newest run first
											) => (
												<div
													key={
														run.run_id ||
														`run-${index}`
													}
													className="space-y-4 border-t border-neutral-800 pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0"
												>
													<div className="flex justify-between items-center text-xs text-neutral-500">
														<span>
															Run #
															{runs.length -
																index}
														</span>
														{run.execution_start_time && (
															<span>
																Executed:{" "}
																{new Date(
																	run.execution_start_time
																).toLocaleString()}
															</span>
														)}
													</div>

													{run.plan &&
														run.plan.length > 0 && (
															<>
																{displayTask.task_type ===
																"swarm" ? (
																	<SwarmPlanSection
																		plan={
																			run.plan
																		}
																	/>
																) : (
																	<div>
																		<h4 className="font-semibold text-neutral-300 mb-2">
																			Executed
																			Plan
																		</h4>
																		<div className="space-y-2">
																			{run.plan.map(
																				(
																					step,
																					stepIndex
																				) => (
																					<div
																						key={
																							stepIndex
																						}
																						className="flex items-start gap-3 p-3 bg-neutral-900/50 rounded-lg border border-neutral-700/50"
																					>
																						<div className="flex-shrink-0 w-5 h-5 bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold">
																							{stepIndex +
																								1}
																						</div>
																						<div>
																							<p className="text-sm font-medium text-neutral-100">
																								{
																									step.tool
																								}
																							</p>
																							<p className="text-sm text-neutral-400">
																								{
																									step.description
																								}
																							</p>
																						</div>
																					</div>
																				)
																			)}
																		</div>
																	</div>
																)}
															</>
														)}

													{run.progress_updates &&
														run.progress_updates
															.length > 0 && (
															<div>
																<h4 className="font-semibold text-neutral-300 mb-2">
																	Execution
																	Log
																	(Advanced)
																</h4>
																<div className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-700/50 space-y-4">
																	{run.progress_updates.map(
																		(
																			update,
																			index
																		) => {
																			const isLastUpdate =
																				index ===
																				run
																					.progress_updates
																					.length -
																					1
																			const isExecuting =
																				[
																					"processing",
																					"planning"
																				].includes(
																					run.status
																				)
																			const messageContent =
																				update
																					.message
																					?.content ||
																				update.message

																			if (
																				isLastUpdate &&
																				isExecuting &&
																				update
																					.message
																					?.type ===
																					"info" &&
																				typeof messageContent ===
																					"string"
																			) {
																				return (
																					<TextShimmer
																						key={
																							index
																						}
																						className="font-mono text-sm text-brand-white"
																						duration={
																							2
																						}
																					>
																						{
																							messageContent
																						}
																					</TextShimmer>
																				)
																			}
																			return (
																				<ExecutionUpdate
																					key={
																						index
																					}
																					update={
																						update
																					}
																				/>
																			)
																		}
																	)}
																</div>
															</div>
														)}

													{run.result && (
														<div className="mt-4">
															<TaskResultDisplay
																result={
																	run.result
																}
															/>
														</div>
													)}

													{run.error && (
														<div>
															<h4 className="font-semibold text-neutral-300 mb-2">
																Error
															</h4>
															<p className="text-sm bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-lg">
																{run.error}
															</p>
														</div>
													)}
												</div>
											)
										)}
								</AccordionContent>
							</AccordionItem>
						</Accordion>
					)}
				</>
			)}

			{/* Show chat input only when a task is completed, to allow for follow-ups. */}
			{!isSubtask &&
				["completed", "completed_with_errors", "error"].includes(
					task.status
				) && (
					<TaskChatSection
						task={task}
						onSendChatMessage={onSendChatMessage}
					/>
				)}
		</div>
	)
}

export default TaskDetailsContent
