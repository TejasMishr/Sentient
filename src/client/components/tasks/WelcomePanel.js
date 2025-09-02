"use client"
import React from "react"
import { motion } from "framer-motion"
import {
	IconSparkles,
	IconMail,
	IconCalendar,
	IconFileText,
	IconX,
	IconBrandSlack,
	IconBrandNotion,
	IconBrandGithub,
	IconBrandWhatsapp,
	IconWorldSearch,
	IconClock,
	IconUsersGroup,
	IconBrandGoogleDrive,
	IconClipboardList
} from "@tabler/icons-react"

const toolIcons = {
	gmail: IconMail,
	gcalendar: IconCalendar,
	gdocs: IconFileText,
	gdrive: IconBrandGoogleDrive,
	whatsapp: IconBrandWhatsapp,
	tasks: IconClipboardList,
	long_form: IconClock,
	swarm: IconUsersGroup,
	slack: IconBrandSlack,
	notion: IconBrandNotion,
	github: IconBrandGithub,
	internet_search: IconWorldSearch
}

const exampleWorkflows = [
	// --- Examples for TASKS view ---
	{
		view: "tasks",
		type: "task",
		title: "Plan a Trip",
		description:
			"A multi-step task to find flights and hotels, demonstrating the orchestrator's long-form capabilities.",
		prompt: "Book a flight from New York to London for next month, find the best deal, and then book a hotel near the airport for 3 nights.",
		tools: ["internet_search", "long_form"]
	},
	{
		view: "tasks",
		type: "task",
		title: "Set a Reminder",
		description:
			"A simple scheduled task that will run once at a specific time in the future.",
		prompt: "Remind me to call the doctor's office tomorrow at 10 AM to confirm my appointment.",
		tools: ["tasks", "gcalendar"]
	},
	{
		view: "tasks",
		type: "task",
		title: "Parallel Research (Swarm)",
		description:
			"A swarm task that processes multiple items in parallel to speed up research.",
		prompt: "Research the following topics and create a brief summary for each: The history of AI, the impact of quantum computing, and the future of renewable energy.",
		tools: ["internet_search", "swarm"]
	},
	// --- Examples for WORKFLOWS view ---
	{
		view: "workflows",
		type: "workflow",
		title: "Daily Briefing",
		description:
			"A recurring workflow that runs every morning to summarize your day.",
		prompt: "Every morning at 8 AM, send me a summary of my unread emails and upcoming calendar events for the day on WhatsApp.",
		tools: ["gmail", "gcalendar", "whatsapp"],
		params: {
			workflowTab: "recurring",
			recurringFrequency: "daily",
			recurringTime: "08:00"
		}
	},
	{
		view: "workflows",
		type: "workflow",
		title: "VIP Email Alert",
		description:
			"A triggered workflow that creates a task whenever you get an email from a specific person.",
		prompt: "Whenever I receive a new email from 'boss@example.com', create a high-priority task for me to review it.",
		tools: ["gmail", "tasks", "bolt"],
		params: { workflowTab: "triggered" }
	},
	{
		view: "workflows",
		type: "workflow",
		title: "Weekly Content Curation",
		description:
			"A recurring workflow to research topics and save them to Notion automatically.",
		prompt: "Every Friday afternoon, find the top 5 news articles in 'technology', summarize them, and add them to my 'Weekly Reading' page in Notion.",
		tools: ["internet_search", "notion"],
		params: {
			workflowTab: "recurring",
			recurringFrequency: "weekly",
			recurringTime: "16:00",
			recurringDays: ["Friday"]
		}
	}
]

const content = {
	tasks: {
		title: "Welcome to Tasks",
		description:
			"This is your command center for getting things done. Create one-time tasks, complex multi-step projects, or actions scheduled for a specific time. Describe what you need, and I'll handle the rest."
	},
	workflows: {
		title: "Welcome to Workflows",
		description:
			"Automate your routines with powerful workflows. Create recurring tasks that run on a schedule or set up triggers that react to events in your connected apps, like new emails or calendar invites."
	}
}

const WelcomePanel = ({ view, onExampleClick, onClose }) => {
	const currentContent = content[view] || content.tasks
	const examples = exampleWorkflows.filter((ex) => ex.view === view)

	return (
		<div className="md:p-6 h-full flex flex-col">
			<header className="flex items-start justify-between text-center mb-6 md:mb-8 flex-shrink-0">
				<div className="flex-1 flex flex-col items-center">
					<IconSparkles
						size={32}
						className="text-brand-orange mb-3"
					/>
					<h2 className="text-xl md:text-2xl font-bold text-white">
						{currentContent.title}
					</h2>
					<p className="text-neutral-400 mt-1 text-sm md:text-base max-w-lg">
						{currentContent.description}
					</p>
				</div>
			</header>
			<div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 px-2 md:px-4">
				<h3 className="font-semibold text-neutral-300 px-2">
					Examples
				</h3>
				{examples.map((workflow, index) => (
					<motion.div
						key={workflow.title}
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: index * 0.1 }}
						onClick={() => onExampleClick(workflow)}
						className="bg-neutral-800/50 p-4 rounded-lg border border-neutral-700 hover:border-brand-orange cursor-pointer transition-colors flex flex-col justify-between"
					>
						<div>
							<div className="flex items-center gap-3 mb-2">
								<div className="flex -space-x-2">
									{workflow.tools.map((toolName) => {
										const Icon =
											toolIcons[toolName] || IconSparkles
										return (
											<div
												key={toolName}
												className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-neutral-900 bg-white text-black"
											>
												<Icon size={16} />
											</div>
										)
									})}
								</div>
								<h4 className="font-semibold text-white">
									{workflow.title}
								</h4>
							</div>
							<p className="text-sm text-neutral-400">
								{workflow.description}
							</p>
						</div>
					</motion.div>
				))}
			</div>
		</div>
	)
}

export default WelcomePanel
