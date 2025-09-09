"use client"

import React from "react"
import { cn } from "@utils/cn"
import { Tooltip } from "react-tooltip"
import { Button } from "@components/ui/button"

const ScheduleEditor = ({ schedule, setSchedule }) => {
	const handleTypeChange = (type) => {
		const baseSchedule = { ...schedule, type: type }
		if (type === "once") {
			delete baseSchedule.frequency
			delete baseSchedule.days
			delete baseSchedule.time
		} else if (type === "triggered") {
			delete baseSchedule.run_at
			delete baseSchedule.frequency
			delete baseSchedule.days
			delete baseSchedule.time
		} else {
			delete baseSchedule.run_at
		}
		setSchedule(baseSchedule)
	}

	const handleRunAtChange = (e) => {
		const localDateTimeString = e.target.value
		if (localDateTimeString) {
			// The input value is a string like "2024-07-26T09:00".
			// new Date() will parse this as 9 AM in the browser's local timezone.
			const localDate = new Date(localDateTimeString)
			// .toISOString() converts it to a UTC string, which is what we want to store.
			setSchedule({ ...schedule, run_at: localDate.toISOString() })
		} else {
			setSchedule({ ...schedule, run_at: null })
		}
	}

	const getLocalDateTimeString = (isoString) => {
		if (!isoString) return ""
		const date = new Date(isoString)
		const tzOffset = date.getTimezoneOffset() * 60000 // offset in milliseconds
		const localISOTime = new Date(date.getTime() - tzOffset)
			.toISOString()
			.slice(0, 16)
		return localISOTime
	}

	const handleDayToggle = (day) => {
		const currentDays = schedule.days || []
		const newDays = currentDays.includes(day)
			? currentDays.filter((d) => d !== day)
			: [...currentDays, day]
		setSchedule({ ...schedule, days: newDays })
	}

	return (
		<div className="bg-neutral-900/60 backdrop-blur-sm p-4 rounded-xl space-y-4 border border-neutral-700/50">
			<div className="flex items-center gap-2">
				{[
					{ label: "Run Once", value: "once" },
					{ label: "Recurring", value: "recurring" },
					{ label: "Triggered", value: "triggered" }
				].map(({ label, value }) => (
					<Button
						key={value}
						type="button"
						onClick={() => handleTypeChange(value)}
						variant={
							(schedule.type || "once") === value
								? "default"
								: "secondary"
						}
						className={cn(
							"rounded-full",
							(schedule.type || "once") === value &&
								"bg-brand-orange text-brand-black font-semibold"
						)}
					>
						{label}
					</Button>
				))}
			</div>

			{(schedule.type === "once" || !schedule.type) && (
				<div>
					<label className="text-sm font-medium text-neutral-400 block mb-2">
						Run At (optional, local time)
					</label>
					<input
						type="datetime-local"
						value={getLocalDateTimeString(schedule.run_at)}
						step="1" // Ensures seconds are included in the value
						onChange={handleRunAtChange}
						className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/80 [color-scheme:dark]"
					/>
					<p className="text-xs text-neutral-500 mt-2">
						If left blank, the task will be planned immediately.
					</p>
				</div>
			)}

			{schedule.type === "triggered" && (
				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium text-neutral-400 block mb-2">
							Source Service
						</label>
						<select
							value={schedule.source || "gmail"}
							onChange={(e) =>
								setSchedule({
									...schedule,
									source: e.target.value
								})
							}
							className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/80"
						>
							<option value="gmail">Gmail</option>
							<option value="slack">Slack</option>
							<option value="gcalendar">Google Calendar</option>
						</select>
					</div>
					<div>
						<label className="text-sm font-medium text-neutral-400 block mb-2">
							Trigger Event
						</label>
						<input
							type="text"
							value={schedule.event || "new_email"}
							onChange={(e) =>
								setSchedule({
									...schedule,
									event: e.target.value
								})
							}
							placeholder="e.g., new_email, new_message"
							className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/80"
						/>
					</div>
					<div>
						<label className="text-sm font-medium text-neutral-400 block mb-2">
							Filter Conditions (JSON)
						</label>
						<textarea
							value={JSON.stringify(
								schedule.filter || {},
								null,
								2
							)}
							onChange={(e) => {
								try {
									const parsed = JSON.parse(e.target.value)
									setSchedule({ ...schedule, filter: parsed })
								} catch (err) {
									// Silently ignore invalid JSON for now
								}
							}}
							rows={4}
							className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/80 font-mono"
							placeholder={`{\n  "from": "boss@example.com",\n  "subject_contains": "Urgent"\n}`}
						/>
						<p className="text-xs text-neutral-500 mt-2">
							Example: {`{"from": "user@example.com"}`}
						</p>
					</div>
				</div>
			)}

			{schedule.type === "recurring" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium text-neutral-400 block mb-2">
							Frequency
						</label>
						<select
							value={schedule.frequency || "daily"}
							onChange={(e) =>
								setSchedule({
									...schedule,
									frequency: e.target.value
								})
							}
							className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/80"
						>
							<option value="daily">Daily</option>
							<option value="weekly">Weekly</option>
						</select>
					</div>
					<div>
						<label className="text-sm font-medium text-neutral-400 block mb-2">
							Time (Local)
						</label>
						<input
							type="time"
							value={schedule.time || "09:00"}
							onChange={(e) =>
								setSchedule({
									...schedule,
									time: e.target.value
								})
							}
							className="w-full p-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/80 [color-scheme:dark]"
						/>
					</div>
					{schedule.frequency === "weekly" && (
						<div className="md:col-span-2">
							<label className="text-sm font-medium text-neutral-400 block mb-2">
								Days
							</label>
							<div className="flex flex-wrap gap-2">
								{[
									"Monday",
									"Tuesday",
									"Wednesday",
									"Thursday",
									"Friday",
									"Saturday",
									"Sunday"
								].map((day) => (
									<Button
										type="button"
										key={day}
										onClick={() => handleDayToggle(day)}
										variant={
											(schedule.days || []).includes(day)
												? "default"
												: "secondary"
										}
										className={cn(
											"rounded-full text-xs font-semibold",
											(schedule.days || []).includes(
												day
											) &&
												"bg-brand-orange text-brand-black"
										)}
									>
										{day.substring(0, 3)}
									</Button>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default ScheduleEditor
