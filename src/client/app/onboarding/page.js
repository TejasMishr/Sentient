"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TextLoop } from "@/components/ui/TextLoop"
import { cn } from "@utils/cn"
import toast from "react-hot-toast"
import { usePostHog } from "posthog-js/react"
import { useRouter } from "next/navigation"
import {
	IconSparkles,
	IconHeart,
	IconBrandWhatsapp,
	IconLoader,
	IconCheck,
	IconX,
	IconBrain
} from "@tabler/icons-react"
import InteractiveNetworkBackground from "@components/ui/InteractiveNetworkBackground"
import { useMutation } from "@tanstack/react-query"
import { useUserStore } from "@stores/app-stores"
import ProgressBar from "@components/onboarding/ProgressBar" // Assuming this component exists
import SparkleEffect from "@components/ui/SparkleEffect"
import SiriSpheres from "@components/voice/SiriSpheres"
import IntroSequence from "@components/onboarding/IntroSequence"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Select } from "@components/ui/select"
import { Textarea } from "@components/ui/textarea"

const countryData = [
	{ name: "United States", code: "US", dial_code: "+1", flag: "🇺🇸" },
	{ name: "India", code: "IN", dial_code: "+91", flag: "🇮🇳" },
	{ name: "United Kingdom", code: "GB", dial_code: "+44", flag: "🇬🇧" },
	{ name: "Canada", code: "CA", dial_code: "+1", flag: "🇨🇦" },
	{ name: "Australia", code: "AU", dial_code: "+61", flag: "🇦🇺" },
	{ name: "Germany", code: "DE", dial_code: "+49", flag: "🇩🇪" },
	{ name: "France", code: "FR", dial_code: "+33", flag: "🇫🇷" },
	{ name: "Brazil", code: "BR", dial_code: "+55", flag: "🇧🇷" },
	{ name: "China", code: "CN", dial_code: "+86", flag: "🇨🇳" },
	{ name: "Japan", code: "JP", dial_code: "+81", flag: "🇯🇵" },
	{ name: "Singapore", code: "SG", dial_code: "+65", flag: "🇸🇬" },
	{ name: "United Arab Emirates", code: "AE", dial_code: "+971", flag: "🇦🇪" },
	{ name: "Other", code: "OTHER", dial_code: "", flag: "🌍" }
]

// --- Helper Components ---

const FormattedPaQuestion = () => (
	<div className="text-neutral-200 space-y-6 md:space-y-8 text-center">
		<div className="text-xl md:text-2xl text-neutral-300 font-medium leading-relaxed">
			<span>Are you someone who often finds themselves </span>
			<TextLoop
				className="inline-block text-brand-orange font-semibold min-w-[280px] md:min-w-[340px]"
				interval={2.5}
			>
				<span>juggling multiple priorities?</span>
				<span>spending too much time on admin tasks?</span>
				<span>managing a small team?</span>
				<span>wishing you had help with scheduling?</span>
			</TextLoop>
		</div>
		<h2 className="font-semibold text-xl md:text-2xl text-white leading-relaxed">
			Do you need a personal assistant (human or AI)?
		</h2>
	</div>
)

// Standard typography styles for questions
const questionStyles = {
	title: "text-xl md:text-2xl text-white font-medium leading-relaxed",
	description:
		"text-sm md:text-base text-neutral-400 mt-3 max-w-2xl mx-auto leading-relaxed",
	container:
		"min-h-[100px] md:min-h-[120px] flex items-center justify-center w-full"
}

// --- Onboarding Data ---

const questions = [
	{
		id: "user-name",
		question: "First, what should I call you?",
		type: "text-input",
		required: true,
		placeholder: "Your name"
	},
	{
		id: "timezone",
		question: "What's your timezone?",
		type: "select",
		required: true,
		options: [
			{ value: "", label: "Select your timezone..." },
			{ value: "UTC", label: "(GMT+00:00) Coordinated Universal Time" },
			{
				value: "America/New_York",
				label: "(GMT-04:00) Eastern Time (US & Canada)"
			},
			{
				value: "America/Chicago",
				label: "(GMT-05:00) Central Time (US & Canada)"
			},
			{
				value: "America/Denver",
				label: "(GMT-06:00) Mountain Time (US & Canada)"
			},
			{
				value: "America/Los_Angeles",
				label: "(GMT-07:00) Pacific Time (US & Canada)"
			},
			{ value: "America/Anchorage", label: "(GMT-08:00) Alaska" },
			{ value: "America/Phoenix", label: "(GMT-07:00) Arizona" },
			{ value: "Pacific/Honolulu", label: "(GMT-10:00) Hawaii" },
			{ value: "America/Sao_Paulo", label: "(GMT-03:00) Brasilia" },
			{
				value: "America/Buenos_Aires",
				label: "(GMT-03:00) Buenos Aires"
			},
			{
				value: "Europe/London",
				label: "(GMT+01:00) London, Dublin, Lisbon"
			},
			{
				value: "Europe/Berlin",
				label: "(GMT+02:00) Amsterdam, Berlin, Paris, Rome"
			},
			{
				value: "Europe/Helsinki",
				label: "(GMT+03:00) Helsinki, Kyiv, Riga, Sofia"
			},
			{
				value: "Europe/Moscow",
				label: "(GMT+03:00) Moscow, St. Petersburg"
			},
			{ value: "Africa/Cairo", label: "(GMT+02:00) Cairo" },
			{ value: "Africa/Johannesburg", label: "(GMT+02:00) Johannesburg" },
			{ value: "Asia/Dubai", label: "(GMT+04:00) Abu Dhabi, Muscat" },
			{ value: "Asia/Kolkata", label: "(GMT+05:30) India Standard Time" },
			{
				value: "Asia/Shanghai",
				label: "(GMT+08:00) Beijing, Hong Kong, Shanghai"
			},
			{ value: "Asia/Singapore", label: "(GMT+08:00) Singapore" },
			{ value: "Asia/Tokyo", label: "(GMT+09:00) Tokyo, Seoul" },
			{
				value: "Australia/Sydney",
				label: "(GMT+10:00) Sydney, Melbourne"
			},
			{ value: "Australia/Brisbane", label: "(GMT+10:00) Brisbane" },
			{ value: "Australia/Adelaide", label: "(GMT+09:30) Adelaide" },
			{ value: "Australia/Perth", label: "(GMT+08:00) Perth" },
			{
				value: "Pacific/Auckland",
				label: "(GMT+12:00) Auckland, Wellington"
			}
		]
	},
	{
		id: "location",
		question: "Where are you located?",
		description:
			"This helps with local info like weather. You can type a city or detect it automatically.",
		type: "location",
		required: true
	},
	{
		id: "professional-context",
		question: "Tell me about your professional background",
		type: "textarea",
		required: true,
		placeholder: "e.g., I'm a software developer at a startup..."
	},
	{
		id: "working-hours",
		question: "What are your usual working hours?",
		description: "This helps me know when to proactively reach out",
		type: "text-input",
		required: false,
		placeholder: "e.g., Mon-Fri, 9 AM to 6 PM"
	},
	{
		id: "key-people",
		question: "Who are the key people in your life I should remember?",
		description:
			"Family members, colleagues, or assistants I should know about",
		type: "textarea",
		required: false,
		placeholder: "e.g., Jane Doe - spouse, John Smith - assistant"
	},
	{
		id: "personal-context",
		question: "Any personal details you'd like me to remember?",
		description:
			"Birthdays, anniversaries, preferences, or anything important to you",
		type: "textarea",
		required: false,
		placeholder: "e.g., My anniversary is on June 5th. I love Italian food."
	},
	{
		id: "needs-pa",
		question: "", // The question is rendered by FormattedPaQuestion component
		type: "yes-no",
		required: true
	},
	{
		id: "whatsapp_notifications_number",
		question: "What's your WhatsApp number?",
		type: "text-input",
		required: true,
		placeholder: "+14155552671",
		icon: <IconBrandWhatsapp />
	}
]

const sentientComments = [
	"To get started, I just need to ask a few questions to personalize your experience.",
	"Great to meet you, {user-name}! To make sure I'm always on your time...",
	"Perfect. Now, to help with local info like weather and places...",
	"This helps me understand your professional goals and context.",
	"Understood. Knowing your work hours helps me be a better assistant.",
	"Thanks. Remembering key people helps me understand your world better.",
	"Great! I'll keep those personal details in mind.",
	"This helps me understand what kind of user you are and how I can best assist you.",
	"Finally, I will send you important notifications, task updates, and reminders on WhatsApp. We're in the process of getting an official number, so for now, messages will come from our co-founder Sarthak (+91827507823), who may also occasionally reach out for feedback.",
	"Awesome! That's all I need. Let's get you set up."
]

// --- Main Component ---

const OnboardingPage = () => {
	const [stage, setStage] = useState("intro") // 'intro', 'questions', 'submitting', 'complete'
	const [answers, setAnswers] = useState({})
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const [score, setScore] = useState(0)
	const [sparkleTrigger, setSparkleTrigger] = useState(0)
	const posthog = usePostHog()
	const { fetchUserData } = useUserStore()
	const router = useRouter()
	const statusChecked = useRef(false)
	const [whatsappStatus, setWhatsappStatus] = useState("idle") // idle, checking, valid, invalid
	const [whatsappError, setWhatsappError] = useState("")
	const debounceTimeoutRef = useRef(null)
	const [customDialCode, setCustomDialCode] = useState("")
	const [showCustomDialCode, setShowCustomDialCode] = useState(false)
	const [modelReacting, setModelReacting] = useState(false)
	const [audioLevel, setAudioLevel] = useState(0.1)
	const [timezoneDetected, setTimezoneDetected] = useState(null) // null: checking, true: detected, false: not detected
	const [whatsappCountry, setWhatsappCountry] = useState(countryData[1]) // Default to India
	const [whatsappLocalNumber, setWhatsappLocalNumber] = useState("")

	const [locationState, setLocationState] = useState({
		loading: false,
		data: null,
		error: null
	})

	// Handle country selection
	const handleCountryChange = (countryCode) => {
		const selectedCountry = countryData.find((c) => c.code === countryCode)
		setWhatsappCountry(selectedCountry)
		setShowCustomDialCode(countryCode === "OTHER")
		if (countryCode !== "OTHER") setCustomDialCode("")
	}

	const verifyWhatsappMutation = useMutation({
		mutationFn: (number) => {
			if (!/^\+[1-9]\d{6,14}$/.test(number.trim())) {
				throw new Error(
					"Please use E.164 format with country code (e.g., +14155552671)."
				)
			}
			return fetch("/api/settings/whatsapp-notifications/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phone_number: number })
			}).then(async (res) => {
				const result = await res.json()
				if (!res.ok) {
					throw new Error(
						result.detail || "Verification request failed."
					)
				}
				return result
			})
		},
		onSuccess: (result) => {
			if (result.numberExists) {
				setWhatsappStatus("valid")
				setWhatsappError("")
			} else {
				setWhatsappStatus("invalid")
				setWhatsappError(
					"This number does not appear to be on WhatsApp."
				)
			}
		},
		onError: (error) => {
			setWhatsappStatus("invalid")
			setWhatsappError(error.message)
		}
	})

	const handleAnswer = (questionId, answer) => {
		setAnswers((prev) => ({ ...prev, [questionId]: answer }))
		if (questionId === "whatsapp_notifications_number") {
			setWhatsappStatus("idle")
			if (debounceTimeoutRef.current) {
				clearTimeout(debounceTimeoutRef.current)
			}
			if (answer.trim()) {
				debounceTimeoutRef.current = setTimeout(() => {
					setWhatsappStatus("checking")
					verifyWhatsappMutation.mutate(answer)
				}, 800)
			} else {
				setWhatsappStatus("idle")
				setWhatsappError("")
			}
		}
	}

	const handleMultiChoice = (questionId, option) => {
		const currentAnswers = answers[questionId] || []
		const limit = questions.find((q) => q.id === questionId)?.limit || 1
		let newAnswers
		if (currentAnswers.includes(option)) {
			newAnswers = currentAnswers.filter((item) => item !== option)
		} else {
			if (currentAnswers.length < limit) {
				newAnswers = [...currentAnswers, option]
			} else {
				toast.error(`You can select up to ${limit} options.`)
				newAnswers = currentAnswers
			}
		}
		setAnswers((prev) => ({ ...prev, [questionId]: newAnswers }))
	}

	const handleGetLocation = () => {
		if (navigator.geolocation) {
			setLocationState({ loading: true, data: null, error: null })
			navigator.geolocation.getCurrentPosition(
				async (position) => {
					const { latitude, longitude } = position.coords
					try {
						const response = await fetch(
							`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
						)
						if (!response.ok) {
							throw new Error("Failed to fetch location details.")
						}
						const data = await response.json()
						const address = data.address
						// Construct a readable location string
						const locationString = [
							address.city || address.town || address.village,
							address.state,
							address.country
						]
							.filter(Boolean) // Remove any null/undefined parts
							.join(", ")

						if (!locationString) {
							throw new Error(
								"Could not determine location name from coordinates."
							)
						}

						// Update state with the text location
						setLocationState({
							loading: false,
							data: locationString, // Store the string
							error: null
						})
						handleAnswer("location", locationString) // Save the string
					} catch (error) {
						setLocationState({
							loading: false,
							data: null,
							error: error.message
						})
						toast.error(
							`Could not convert coordinates to location: ${error.message}`
						)
					}
				},
				(error) => {
					let userMessage =
						"An unknown error occurred while detecting your location."
					switch (error.code) {
						case error.PERMISSION_DENIED:
							userMessage =
								"Location permission denied. Please enable location access for this site in your browser settings and try again."
							break
						case error.POSITION_UNAVAILABLE:
							userMessage =
								"Location information is unavailable. This can happen if location services are turned off in your operating system (e.g., Windows or macOS). Please check your system settings and network connection."
							break
						case error.TIMEOUT:
							userMessage =
								"The request to get your location timed out. Please try again."
							break
					}
					setLocationState({
						loading: false,
						data: null,
						error: userMessage
					})
					toast.error(userMessage)
				}
			)
		}
	}

	const isCurrentQuestionAnswered = useCallback(() => {
		if (stage !== "questions" || currentQuestionIndex >= questions.length)
			return false
		const currentQuestion = questions[currentQuestionIndex]
		if (!currentQuestion.required) return true
		const answer = answers[currentQuestion.id]

		// Check for undefined, null, or empty values
		if (answer === undefined || answer === null) return false

		// For string values, check if empty or whitespace-only
		if (typeof answer === "string" && answer.trim() === "") return false

		// For arrays, check if empty
		if (Array.isArray(answer) && answer.length === 0) return false

		// Check for whatsapp validation
		if (
			currentQuestion.id === "whatsapp_notifications_number" &&
			whatsappStatus !== "valid"
		) {
			return false
		}
		return true
	}, [answers, currentQuestionIndex, stage, whatsappStatus])

	const submitOnboardingMutation = useMutation({
		mutationFn: (onboardingData) =>
			fetch("/api/onboarding", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: onboardingData })
			}).then(async (res) => {
				if (!res.ok) {
					const result = await res.json()
					throw new Error(
						result.message || "Failed to save onboarding data"
					)
				}
				return res.json()
			}),
		onSuccess: async (data, submittedAnswers) => {
			posthog?.identify(
				(await (await fetch("/api/user/profile")).json()).sub, // Fetch user ID from session
				{ name: submittedAnswers["user-name"] }
			)
			posthog?.capture("user_signed_up", { signup_method: "auth0" })
			posthog?.capture("onboarding_completed")
			await fetchUserData() // Refresh user data in the store
			router.push("/chat?show_demo=true")
		},
		onError: (error) => {
			toast.error(`Error: ${error.message}`)
			setStage("questions") // Go back to questions on error
		}
	})

	const handleNext = useCallback(() => {
		if (!isCurrentQuestionAnswered()) return

		// Trigger sphere reaction immediately
		setModelReacting(true)
		setAudioLevel(0.9) // High impact
		setSparkleTrigger((c) => c + 1)

		setTimeout(() => setModelReacting(false), 400)

		if (currentQuestionIndex < questions.length - 1) {
			setCurrentQuestionIndex((prev) => prev + 1)
		} else {
			setStage("submitting")
			submitOnboardingMutation.mutate(answers)
		}
	}, [
		currentQuestionIndex,
		isCurrentQuestionAnswered,
		handleSubmit,
		maxQuestionIndexReached
	])
	// --- Effects ---

	useEffect(() => {
		if (whatsappCountry && whatsappLocalNumber.trim()) {
			const dialCode =
				whatsappCountry.code === "OTHER"
					? customDialCode.startsWith("+")
						? customDialCode
						: `+${customDialCode}`
					: whatsappCountry.dial_code

			const fullNumber = `${
				dialCode
			}${whatsappLocalNumber.replace(/\D/g, "")}`
			handleAnswer("whatsapp_notifications_number", fullNumber)
		} else {
			// Clear the answer if the local number is empty
			handleAnswer("whatsapp_notifications_number", "")
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [whatsappCountry, whatsappLocalNumber, customDialCode])

	useEffect(() => {
		if (statusChecked.current) return
		statusChecked.current = true

		const checkStatus = async () => {
			try {
				const response = await fetch("/api/user/data", {
					method: "POST"
				})
				if (!response.ok) throw new Error("Could not fetch user data.")
				const result = await response.json()
				if (result?.data?.onboardingComplete) {
					router.push("/chat")
				} else {
					setIsLoading(false)
				}
			} catch (error) {
				toast.error(error.message)
				setIsLoading(false)
			}
		}
		checkStatus()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [router])

	useEffect(() => {
		try {
			const userTimezone =
				Intl.DateTimeFormat().resolvedOptions().timeZone
			if (userTimezone) {
				handleAnswer("timezone", userTimezone)
				setTimezoneDetected(true)
			} else {
				setTimezoneDetected(false)
			}
		} catch (e) {
			console.warn("Could not detect user timezone.")
			setTimezoneDetected(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (stage === "questions") {
				if (e.key === "Enter") {
					const currentQuestion = questions[currentQuestionIndex]
					if (currentQuestion.type === "textarea" && e.shiftKey) {
						return
					}
					e.preventDefault()
					handleNext()
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [stage, handleNext, currentQuestionIndex])

	useEffect(() => {
		let interval
		if (modelReacting) {
			setAudioLevel(0.8) // Spike the level for reaction
		} else {
			// Gentle pulse
			interval = setInterval(() => {
				setAudioLevel(Math.sin(Date.now() / 400) * 0.05 + 0.1)
			}, 50)
		}
		return () => clearInterval(interval)
	}, [modelReacting])

	// --- Render Logic ---

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-brand-black text-brand-white">
				<IconLoader className="w-10 h-10 animate-spin text-[var(--color-accent-blue)]" />
			</div>
		)
	}

	const renderContent = () => {
		switch (stage) {
			case "questions":
				const currentQuestion = questions[currentQuestionIndex] ?? null
				return (
					// Use a motion.div for AnimatePresence transitions
					<motion.div
						key="questions-view"
						className="w-full h-full relative"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					>
						{/* SiriSpheres at top */}
						<motion.div
							layoutId="onboarding-sphere"
							initial={{ scale: 1, y: 0 }}
							animate={{ scale: 0.7, y: -20 }}
							transition={{ duration: 0.8, ease: "easeInOut" }}
							className="absolute md:top-[-30px] sm:top-[100px] left-1/2 -translate-x-1/2 right-1/2 w-[300px] h-[300px] md:w-[450px] md:h-[450px] pointer-events-none z-0"
						>
							<div className="w-full h-full opacity-90">
								<SiriSpheres
									status="connected"
									audioLevel={audioLevel}
								/>
							</div>
						</motion.div>

						{/* Progress Bar */}
						<div className="fixed bottom-0 left-0 right-0 w-full px-4 py-6 md:py-8 z-20 pointer-events-none">
							<div className="max-w-4xl mx-auto">
								<ProgressBar
									score={score}
									totalQuestions={questions.length}
								/>
							</div>
						</div>

						{/* Questions Container */}
						<div className="relative z-10 w-full h-full flex flex-col items-center justify-center pt-32 md:pt-40 pb-8">
							<motion.div
								key="questions-stage"
								initial={{ opacity: 0, y: 30 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3, duration: 0.6 }}
								className="w-full max-w-4xl flex flex-col items-center gap-6 md:gap-8 text-center px-4"
							>
								{/* Question Text */}
								<AnimatePresence mode="wait" initial={false}>
									<motion.div
										key={currentQuestionIndex}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -20 }}
										transition={{ duration: 0.4 }}
										className={questionStyles.container}
									>
										<div className="w-full">
											{currentQuestion.id ===
											"needs-pa" ? (
												<FormattedPaQuestion />
											) : (
												<>
													<h2
														className={
															questionStyles.title
														}
													>
														{
															currentQuestion.question
														}
													</h2>
													{currentQuestion.description && (
														<p
															className={
																questionStyles.description
															}
														>
															{
																currentQuestion.description
															}
														</p>
													)}
												</>
											)}
										</div>
									</motion.div>
								</AnimatePresence>

								{/* Answer Input */}
								<div className="w-full max-w-2xl min-h-[80px] flex items-center justify-center">
									{currentQuestion &&
										renderInput(currentQuestion)}
								</div>

								{/* Navigation */}
								{currentQuestion.type !== "yes-no" && (
									<div className="mt-4 md:mt-6">
										<Button
											onClick={handleNext}
											disabled={
												!isCurrentQuestionAnswered()
											}
											size="lg"
											className="rounded-xl bg-brand-orange text-brand-black text-base md:text-lg font-semibold transition-all duration-300 hover:bg-brand-orange/90 hover:scale-105 shadow-lg shadow-brand-orange/25"
										>
											{currentQuestionIndex ===
											questions.length - 1
												? "Finish"
												: "Next"}
										</Button>
									</div>
								)}
							</motion.div>
						</div>
					</motion.div>
				)

			case "submitting":
				return (
					// prettier-ignore
					<motion.div
						key="submitting"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="w-full h-full flex flex-col items-center justify-center text-center"
					>
						<div className="w-[300px] h-[300px] md:w-[400px] md:h-[400px]">
							<SiriSpheres status="connecting" />
						</div>
						<h1 className="text-2xl md:text-3xl font-medium text-neutral-200 mt-8">
							Personalizing your experience...
						</h1>
					</motion.div>
				)

			case "complete":
				return (
					<motion.div
						key="complete"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-center"
					>
						<IconCheck className="w-24 h-24 text-brand-green mx-auto mb-6" />
						<h1 className="text-5xl font-bold mb-4">
							All Set, {answers["user-name"] || "Friend"}!
						</h1>
						<p className="text-xl text-neutral-400">
							Your personal AI companion is ready.
						</p>
						<p className="text-lg text-neutral-500 mt-4">
							Redirecting you to home...
						</p>
					</motion.div>
				)

			default:
				return null
		}
	}

	const renderInput = (currentQuestion) => {
		switch (currentQuestion.type) {
			case "text-input":
				if (currentQuestion.id === "whatsapp_notifications_number") {
					return (
						<div className="relative w-full max-w-lg mx-auto space-y-4">
							<div className="flex items-center gap-0 w-full bg-neutral-900/60 backdrop-blur-sm border border-neutral-700/50 rounded-xl focus-within:ring-2 focus-within:ring-brand-orange/50 focus-within:border-brand-orange/50 transition-all duration-300 shadow-lg shadow-black/20">
								<div className="relative border-r border-neutral-700/50">
									<Select
										value={whatsappCountry.code}
										onChange={(e) => {
											handleCountryChange(e.target.value)
										}}
										className="bg-transparent pl-4 pr-10 py-4 md:py-5 text-base appearance-none focus:outline-none cursor-pointer min-w-[120px] border-none h-auto"
									>
										{countryData.map((country) => (
											<option
												key={country.code}
												value={country.code}
												className="bg-brand-gray text-brand-white"
											>
												{country.flag}{" "}
												{country.dial_code || "Other"}
											</option>
										))}
									</Select>
									<div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral-400">
										<svg
											className="h-4 w-4 fill-current"
											viewBox="0 0 20 20"
										>
											<path d="M5.516 7.548c.436-.446 1.043-.481 1.576 0L10 10.405l2.908-2.857c.533-.481 1.141-.446 1.574 0 .436.445.408 1.197 0 1.642l-3.417 3.356c-.27.267-.672.423-1.065.423s-.795-.156-1.065-.423L5.516 9.19c-.408-.445-.436-1.197 0-1.642z" />
										</svg>
									</div>
								</div>
								{showCustomDialCode && (
									<Input
										type="text"
										value={customDialCode}
										onChange={(e) =>
											setCustomDialCode(e.target.value)
										}
										placeholder="+XXX"
										className="bg-transparent px-4 py-4 md:py-5 text-base focus:outline-none border-r border-neutral-700/50 w-20 h-auto rounded-none border-none"
									/>
								)}
								<Input
									type="tel"
									value={whatsappLocalNumber}
									onChange={(e) =>
										setWhatsappLocalNumber(e.target.value)
									}
									placeholder="Your number"
									required={currentQuestion.required}
									autoFocus
									className="flex-1 bg-transparent px-4 py-4 md:py-5 text-base md:text-lg placeholder:text-neutral-500 focus:outline-none border-none h-auto"
								/>
							</div>

							{/* Status Icons */}
							<div className="absolute right-4 top-1/2 -translate-y-1/2">
								{whatsappStatus === "checking" && (
									<IconLoader
										size={20}
										className="animate-spin text-brand-orange"
									/>
								)}
								{whatsappStatus === "valid" && (
									<IconCheck
										size={20}
										className="text-green-400"
									/>
								)}
								{whatsappStatus === "invalid" && (
									<IconX size={20} className="text-red-400" />
								)}
							</div>

							{/* Error Message */}
							{whatsappStatus === "invalid" && whatsappError && (
								<p className="text-red-400 text-sm mt-2 text-center bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
									{whatsappError}
								</p>
							)}

							{/* Instructions for Other option */}
							{showCustomDialCode && (
								<p className="text-neutral-400 text-sm text-center">
									Enter your country code (e.g., +33 for
									France)
								</p>
							)}
						</div>
					)
				}
				return (
					<div className="relative w-full max-w-lg mx-auto">
						<Input
							type="text"
							value={answers[currentQuestion.id] || ""}
							onChange={(e) =>
								handleAnswer(currentQuestion.id, e.target.value)
							}
							placeholder={currentQuestion.placeholder}
							required={currentQuestion.required}
							autoFocus
							className="px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20"
						/>
					</div>
				)
			case "select":
				// Special handling for timezone question
				if (currentQuestion.id === "timezone") {
					const detectedTimezone = answers[currentQuestion.id]
					const isTimezoneInOptions = currentQuestion.options.some(
						(opt) => opt.value === detectedTimezone
					)

					// Create a dynamic options list
					let timezoneOptions = [...currentQuestion.options]

					// If detected timezone is not in the list, add it
					if (
						timezoneDetected &&
						detectedTimezone &&
						!isTimezoneInOptions
					) {
						timezoneOptions.unshift({
							value: detectedTimezone,
							label: detectedTimezone.replace(/_/g, " ")
						})
					}

					// Modify placeholder if detection failed
					if (timezoneDetected === false) {
						timezoneOptions[0] = {
							value: "",
							label: "Couldn't detect. Please select..."
						}
					}

					return (
						<div className="w-full max-w-xl mx-auto text-center">
							<Select
								value={answers[currentQuestion.id] || ""}
								onChange={(e) =>
									handleAnswer(
										currentQuestion.id,
										e.target.value
									)
								}
								required={currentQuestion.required}
								disabled={timezoneDetected === true}
								className="px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20 appearance-none"
							>
								{timezoneOptions.map((option) => (
									<option
										key={option.value}
										value={option.value}
										disabled={option.disabled}
										className="bg-brand-gray text-brand-white"
									>
										{option.label}
									</option>
								))}
							</Select>
							{timezoneDetected === true && (
								<p className="text-green-400 text-sm mt-3 bg-green-400/10 border border-green-400/20 rounded-lg px-4 py-2">
									We've automatically detected your timezone.
								</p>
							)}
							{timezoneDetected === false && (
								<p className="text-yellow-400 text-sm mt-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-4 py-2">
									We couldn't detect your timezone
									automatically.
								</p>
							)}
						</div>
					)
				}
				// Default select rendering for other questions
				return (
					<div className="w-full max-w-xl mx-auto">
						<Select
							value={answers[currentQuestion.id] || ""}
							onChange={(e) =>
								handleAnswer(currentQuestion.id, e.target.value)
							}
							required={currentQuestion.required}
							className="px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20 appearance-none"
						>
							{currentQuestion.options.map((option) => (
								<option
									key={option.value}
									value={option.value}
									disabled={option.disabled}
									className="bg-brand-gray text-brand-white"
								>
									{option.label}
								</option>
							))}
						</Select>
					</div>
				)
			case "textarea":
				return (
					<div className="w-full max-w-3xl mx-auto">
						<Textarea
							value={answers[currentQuestion.id] || ""}
							onChange={(e) =>
								handleAnswer(currentQuestion.id, e.target.value)
							}
							className="w-full h-32 md:h-40 px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 resize-none transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20"
							placeholder={currentQuestion.placeholder}
							autoFocus
							rows={4}
						/>
					</div>
				)
			case "location":
				return (
					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 w-full max-w-3xl mx-auto">
						<Input
							type="text"
							placeholder="Enter Locality, City, State..."
							value={
								typeof answers[currentQuestion.id] === "string"
									? answers[currentQuestion.id]
									: ""
							}
							onChange={(e) =>
								handleAnswer("location", e.target.value)
							}
							className="px-6 py-4 md:py-5 bg-neutral-900/60 backdrop-blur-sm border-neutral-700/50 rounded-xl focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-300 text-center text-base md:text-lg placeholder:text-neutral-500 shadow-lg shadow-black/20 sm:flex-grow"
						/>
						<span className="hidden sm:inline text-neutral-400 text-base font-medium">
							or
						</span>
						<span className="sm:hidden text-neutral-400 text-base">
							or
						</span>
						<Button
							type="button"
							onClick={handleGetLocation}
							disabled={locationState.loading}
							variant="outline"
							className="px-6 py-3 md:py-4 rounded-xl transition-all duration-300 whitespace-nowrap disabled:opacity-50 font-medium border-brand-orange/30 text-brand-orange hover:bg-brand-orange/10"
						>
							{locationState.loading
								? "Detecting..."
								: "Detect Current Location"}
						</Button>
					</div>
				)
			case "yes-no":
				return (
					<div className="flex gap-4 md:gap-6 justify-center w-full max-w-lg mx-auto">
						<Button
							onClick={() => {
								handleAnswer(currentQuestion.id, "yes")
								setTimeout(handleNext, 150)
							}}
							size="lg"
							className={cn(
								"flex-1 rounded-xl font-semibold transition-all duration-300 text-base md:text-lg backdrop-blur-sm shadow-lg",
								answers[currentQuestion.id] === "yes"
									? "bg-brand-orange text-brand-black shadow-brand-orange/30 scale-105"
									: "bg-neutral-800/60 border border-neutral-700/50 hover:bg-neutral-700/60 hover:border-neutral-600/50 text-white"
							)}
						>
							Yes
						</Button>
						<Button
							onClick={() => {
								handleAnswer(currentQuestion.id, "no")
								setTimeout(handleNext, 150)
							}}
							size="lg"
							className={cn(
								"flex-1 rounded-xl font-semibold transition-all duration-300 text-base md:text-lg backdrop-blur-sm shadow-lg",
								answers[currentQuestion.id] === "no"
									? "bg-brand-orange text-brand-black shadow-brand-orange/30 scale-105"
									: "bg-neutral-800/60 border border-neutral-700/50 hover:bg-neutral-700/60 hover:border-neutral-600/50 text-white"
							)}
						>
							No
						</Button>
					</div>
				)

			default:
				return null
		}
	}

	return (
		<div className="relative flex flex-col items-center min-h-screen w-full text-brand-white overflow-hidden">
			<div className="absolute inset-0 z-[-1]">
				<InteractiveNetworkBackground />
			</div>
			<div className="absolute -top-[250px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-orange/10 rounded-full blur-3xl -z-10" />
			<div className={cn("relative z-10 w-full h-screen")}>
				<SparkleEffect trigger={sparkleTrigger} />
				<AnimatePresence mode="wait">
					{stage === "intro" ? (
						<IntroSequence
							onComplete={() => setStage("questions")}
						/>
					) : (
						renderContent()
					)}
				</AnimatePresence>
			</div>
		</div>
	)
}

export default OnboardingPage
