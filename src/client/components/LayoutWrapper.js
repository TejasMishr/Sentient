// src/client/components/LayoutWrapper.js
"use client"
import React, {
	useState,
	useEffect,
    useCallback,
    useMemo,
	useRef,
	createContext,
	useContext
} from "react"
// Import useSearchParams
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import NotificationsOverlay from "@components/NotificationsOverlay"
import { IconMenu2, IconLoader, IconX } from "@tabler/icons-react"
import Sidebar from "@components/Sidebar"
import GlobalSearch from "./GlobalSearch"
import { useGlobalShortcuts } from "@hooks/useGlobalShortcuts"
import { cn } from "@utils/cn"
import toast from "react-hot-toast"
import { useUser } from "@auth0/nextjs-auth0"
import { usePostHog } from "posthog-js/react"
import { motion } from "framer-motion"

// ... (keep the rest of your imports and context creation)
export const PlanContext = createContext({
	plan: "free",
	isPro: false,
	isLoading: true
})
export const TourContext = createContext(null)
export const useTour = () => useContext(TourContext)
import { subscribeUser } from "@app/actions"

// ... (keep your urlBase64ToUint8Array function)
function urlBase64ToUint8Array(base64String) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
	const base64 = (base64String + padding)
		.replace(/-/g, "+")
		.replace(/_/g, "/")
	const rawData = atob(base64)
	const outputArray = new Uint8Array(rawData.length)
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i)
	}
	return outputArray
}

const GuidedTour = () => {
	const tour = useTour()
	const { tourState, nextStep, skipTour, finishTour } = tour
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const [targetRect, setTargetRect] = useState(null)
	const [tooltipContent, setTooltipContent] = useState({
		title: "",
		body: "",
		instruction: ""
	})
	const [modalContent, setModalContent] = useState({
		title: "",
		body: "",
		buttons: []
	})
	const [isWaiting, setIsWaiting] = useState(false)

	const tourSteps = [
		// Step 0: Welcome Mat (Modal)
		{
			type: "modal",
			title: "Welcome to Sentient! Let's see your AI in action.",
			body: "This quick, interactive tour will show you how I handle everything from simple commands to complex projects. You'll get to see the full lifecycle of an automated task.",
			buttons: [
				{
					label: "Start Tour",
					onClick: () => nextStep(),
					primary: true
				},
				{ label: "Skip for now", onClick: skipTour }
			]
		},
		// Step 1: Connect Gmail
		{
			type: "tooltip",
			path: "/integrations",
			selector: "[data-tour-id='gmail-card']",
			title: "Step 1/8: Connect an App",
			body: "Let's connect Gmail. We'll use it for a safe, simple task—sending an email to our own team address. I won't touch any of your other emails.",
			instruction: "Click Connect to get started.",
			wait_for: "integration_success"
		},
		// Step 2: Send Chat Message
		{
			type: "tooltip",
			path: "/chat",
			selector: "textarea",
			title: "Step 2/8: Give a Command",
			body: "For quick actions, you can tell me what to do. I'll handle it and reply here. After you send the message, click Next.",
			instruction: "Let's send a test email. Type this and press Enter:",
			prefill:
				"Send a 'Hello World' email to existence.sentient@gmail.com"
		},
		// Step 3: Go to Tasks Page
		{
			type: "tooltip",
			path: "/chat",
			selector: "[data-tour-id='sidebar-tasks-icon']",
			title: "Step 3/8: Delegating Complex Work",
			body: "That was a simple task. For bigger goals with multiple steps, I create a project on the Tasks page that you can track. Let's see a simulation of how that works.",
			instruction: "Click the Tasks icon to continue."
		},
		// Step 4: Task Simulation
		{
			type: "tooltip",
			path: "/tasks",
			selector: "[data-tour-id='demo-task-card']",
			title: "Step 4/8: The Lifecycle of a Task",
			body: "Here's a sample project. Right now, it's in the 'Planning' stage. I'm breaking down the goal into a series of steps.",
			instruction: "Click 'Simulate Next Step' to see what happens next.",
			custom_button: "Simulate Next Step"
		},
		// Step 5: Workflows Tab
		{
			type: "tooltip",
			path: "/tasks",
			selector: "[data-tour-id='workflows-tab']",
			title: "Step 5/8: Automate Your Routines",
			body: "What we just saw was a one-time project. For tasks that repeat (e.g., 'send a weekly report') or are triggered by events (e.g., 'on every new email from my boss...'), you can create a Workflow.",
			instruction:
				"You can create these from chat or build them manually here. Let's move on."
		},
		// Step 6: Create Task Button
		{
			type: "tooltip",
			path: "/tasks",
			selector: "[data-tour-id='create-task-button']",
			title: "Step 6/8: Full Control",
			body: "For more control, you can create any task or workflow yourself using the Task Composer. You don't need to create one now.",
			instruction: "Let's check out the settings page."
		},
		// Step 7: Settings Page
		{
			type: "tooltip",
			path: "/settings",
			selector: "[data-tour-id='notifications-section']",
			title: "Step 7/8: Stay in the Loop",
			body: "This is the Settings page. Here you can manage your profile, integrations, and—most importantly—how you get notified about task updates like the one we just simulated.",
			instruction: "Let's finish up."
		},
		// Step 8: Tour Complete (Modal)
		{
			type: "modal",
			title: "You're Ready to Go!",
			body: "You've now seen how Sentient can handle immediate commands, orchestrate complex projects, and automate your work with workflows. You can replay the task simulation anytime from the Help menu.",
			buttons: [
				{ label: "Finish Tour", onClick: finishTour, primary: true }
			]
		}
	]

	useEffect(() => {
		if (!tourState.isActive) {
			setTargetRect(null)
			setIsWaiting(false)
			return
		}

		const currentStepConfig = tourSteps[tourState.step]
		if (!currentStepConfig) {
			finishTour()
			return
		}

		// Handle navigation
		if (currentStepConfig.path && pathname !== currentStepConfig.path) {
			router.push(currentStepConfig.path)
			// We wait for the new page to render the target element.
			// A timeout is a simple way to handle this.
			setTimeout(() => tour.setTourState((s) => ({ ...s })), 200) // Force re-render
			return
		}

		// Handle waiting conditions
		const waitCondition = currentStepConfig.wait_for
		if (waitCondition) {
			setIsWaiting(true)
			if (waitCondition === "integration_success") {
				const successParam = searchParams.get("integration_success")
				if (successParam) {
					router.replace(pathname, { scroll: false })
					nextStep()
					return
				}
			}
		} else {
			setIsWaiting(false)
		}

		if (currentStepConfig.type === "modal") {
			setModalContent(currentStepConfig)
			setTargetRect(null)
		} else if (currentStepConfig.type === "tooltip") {
			setTooltipContent(currentStepConfig)
			const target = document.querySelector(currentStepConfig.selector)
			if (target) {
				setTargetRect(target.getBoundingClientRect())
				target.scrollIntoView({
					behavior: "smooth",
					block: "center",
					inline: "center"
				})
			} else {
				setTargetRect(null)
			}
		}

		// Handle special actions for steps
		if (
			tourState.step === 2 &&
			currentStepConfig.prefill &&
			tour.chatActionsRef.current
		) {
			tour.chatActionsRef.current?.setInput(currentStepConfig.prefill)
		}
	}, [
		tourState.step,
		tourState.isActive,
		pathname,
		router,
		finishTour,
		tour.chatActionsRef,
		tour.setTourState,
		searchParams,
		nextStep
	])

	if (!tourState.isActive) return null

	const currentStepConfig = tourSteps[tourState.step]
	if (!currentStepConfig) return null

	const renderContent = () => {
		if (currentStepConfig.type === "modal") {
			return (
				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.9 }}
					className="bg-neutral-900/90 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-md border border-neutral-700 flex flex-col text-center"
				>
					<h2 className="text-xl font-bold text-white mb-2">
						{modalContent.title}
					</h2>
					<p className="text-neutral-300 mb-6">{modalContent.body}</p>
					<div className="flex justify-center gap-3">
						{modalContent.buttons.map((button) => (
							<button
								key={button.label}
								onClick={button.onClick}
								className={cn(
									"py-2 px-5 rounded-lg text-sm font-medium",
									button.primary
										? "bg-brand-orange text-brand-black"
										: "bg-neutral-700 hover:bg-neutral-600"
								)}
							>
								{button.label}
							</button>
						))}
					</div>
				</motion.div>
			)
		}

		if (currentStepConfig.type === "tooltip" && targetRect) {
			return (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					style={{
						position: "absolute",
						top: targetRect.bottom + 10,
						left: targetRect.left,
						maxWidth: 300
					}}
					className="bg-neutral-900/90 backdrop-blur-xl p-4 rounded-lg shadow-2xl w-full border border-neutral-700 z-10"
				>
					<h3 className="font-bold text-white mb-1">
						{tooltipContent.title}
					</h3>
					<p className="text-sm text-neutral-300 mb-3">
						{tooltipContent.body}
					</p>
					<p
						className="text-sm text-neutral-400 italic mb-4"
						dangerouslySetInnerHTML={{
							__html: tooltipContent.instruction
						}}
					/>
					<div className="flex justify-end gap-2">
						<button
							onClick={skipTour}
							className="text-xs text-neutral-400 hover:text-white"
						>
							Skip
						</button>
						{!isWaiting && !currentStepConfig.custom_button && (
							<button
								onClick={nextStep}
								className="py-1 px-3 text-sm rounded-md bg-brand-orange text-brand-black font-semibold"
							>
								Next
							</button>
						)}
						{currentStepConfig.custom_button && (
							<button
								onClick={() => tour.handleCustomAction()}
								className="py-1 px-3 text-sm rounded-md bg-brand-orange text-brand-black font-semibold"
							>
								{currentStepConfig.custom_button}
							</button>
						)}
					</div>
				</motion.div>
			)
		}
		return null
	}

	return (
		<div className="fixed inset-0 z-[1000] pointer-events-none">
			<AnimatePresence>
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-auto"
				>
					{renderContent()}
				</motion.div>
			</AnimatePresence>
			{targetRect && (
				<div
					className="absolute rounded-lg border-2 border-brand-orange border-dashed shadow-2xl pointer-events-none"
					style={{
						left: targetRect.left - 4,
						top: targetRect.top - 4,
						width: targetRect.width + 8,
						height: targetRect.height + 8,
						transition: "all 0.3s ease-in-out"
					}}
				/>
			)}
		</div>
	)
}

export default function LayoutWrapper({ children }) {
	// ... (keep all your existing state declarations)
	const [isNotificationsOpen, setNotificationsOpen] = useState(false)
	const [isSearchOpen, setSearchOpen] = useState(false)
	const [isMobileNavOpen, setMobileNavOpen] = useState(false)
	const [unreadCount, setUnreadCount] = useState(0)
	const [notifRefreshKey, setNotifRefreshKey] = useState(0)
	const [userDetails, setUserDetails] = useState(null)
	const wsRef = useRef(null)
	const pathname = usePathname()
	const router = useRouter()
	const searchParams = useSearchParams() // Hook to read URL query parameters
	const posthog = usePostHog()

	const { user, error: authError, isLoading: isAuthLoading } = useUser()

	const [isLoading, setIsLoading] = useState(true)
	const [isAllowed, setIsAllowed] = useState(false)

	// --- Guided Tour State ---
	const [tourState, setTourState] = useState({
		isActive: false,
		step: 0,
		subStep: 0 // For multi-part steps like the task simulation
	})
	const chatActionsRef = useRef(null)

	const startTour = useCallback(() => {
		setTourState({ isActive: true, step: 0, subStep: 0 })
	}, [])

	const nextStep = useCallback(() => {
		setTourState((prev) => ({ ...prev, step: prev.step + 1, subStep: 0 }))
	}, [])

	const skipTour = useCallback(() => {
		setTourState({ isActive: false, step: 0, subStep: 0 })
	}, [])

	const finishTour = useCallback(() => {
		setTourState({ isActive: false, step: 0, subStep: 0 })
		// Potentially set a flag in localStorage or user profile to not show again
	}, [])

	const startTaskDemo = useCallback(() => {
		setTourState({ isActive: true, step: 4, subStep: 0 })
	}, [])

	const handleCustomAction = useCallback(() => {
		setTourState((prev) => {
			if (prev.step === 4 && prev.subStep >= 3) {
				return { ...prev, step: prev.step + 1, subStep: 0 }
			}
			return { ...prev, subStep: prev.subStep + 1 }
		})
	}, [])

	const tourValue = useMemo(
		() => ({
			tourState,
			setTourState,
			startTour,
			nextStep,
			skipTour,
			finishTour,
			startTaskDemo,
			handleCustomAction,
			chatActionsRef
		}),
		[tourState, startTour, nextStep, skipTour, finishTour, startTaskDemo, handleCustomAction]
	)

	const showNav = !["/", "/onboarding", "/complete-profile"].includes(
		pathname
	)

	useEffect(() => {
		if (user && posthog) {
			posthog.identify(user.sub, {
				name: user.name,
				email: user.email
			})

			// --- NEW: Fetch custom properties and set PostHog groups ---
			const fetchAndSetUserGroups = async () => {
				try {
					// This is a new client-side API route that proxies to the main server
					const res = await fetch("/api/user/properties")
					if (!res.ok) {
						console.error(
							"Failed to fetch user properties for PostHog, status:",
							res.status
						)
						return // Don't proceed if the call fails
					}

					const properties = await res.json()

					// Set groups in PostHog
					// This allows creating cohorts based on group properties
					posthog.group("plan", properties.plan_type, {
						name:
							properties.plan_type.charAt(0).toUpperCase() +
							properties.plan_type.slice(1)
					})

					posthog.group(
						"insider_status",
						properties.is_insider ? "insider" : "not_insider",
						{
							name: properties.is_insider
								? "Insiders"
								: "Not Insiders"
						}
					)

					// Also set as person properties for easier direct filtering on users
					posthog.setPersonProperties({
						plan_type: properties.plan_type,
						is_insider: properties.is_insider
					})
				} catch (error) {
					console.error(
						"Error fetching/setting user properties for PostHog:",
						error
					)
				}
			}

			fetchAndSetUserGroups()
			// --- END NEW ---
		}
	}, [user, posthog])

	useEffect(() => {
		const paymentStatus = searchParams.get("payment_status")
		const needsRefresh = searchParams.get("refresh_session")

		if (paymentStatus === "success" && posthog) {
			posthog.capture("plan_upgraded", {
				plan_name: "pro"
				// MRR and billing_cycle are not available on the client
			})
		}
		// Check for either trigger
		if (paymentStatus === "success" || needsRefresh === "true") {
			// CRITICAL FIX: Clean the URL synchronously *before* doing anything else.
			// This prevents the refresh loop.
			window.history.replaceState(null, "", pathname)
			const toastId = toast.loading("Updating your session...", {
				duration: 4000
			})

			// const refreshSession = async () => {
			// 	const toastId = toast.loading("Updating your session...", {
			// 		duration: 4000
			// 	})
			// 	try {
			// 		// Call the API to get a new session cookie
			// 		const res = await fetch("/api/auth/refresh-session")
			// 		if (!res.ok) {
			// 			const errorData = await res.json()
			// 			throw new Error(
			// 				errorData.error || "Session refresh failed."
			// 			)
			// 		}

			// 		// Now that the cookie is updated and the URL is clean, reload the page.
			// 		// This will re-run server components and hooks with the new session data.
			// 		window.location.reload()
			// 	} catch (error) {
			// 		toast.error(
			// 			`Failed to refresh session: ${error.message}. Please log in again to see your new plan.`,
			// 			{ id: toastId }
			// 		)
			// 	}
			// }
			// refreshSession()

			const logoutUrl = new URL("/auth/logout", window.location.origin)
			logoutUrl.searchParams.set(
				"returnTo",
				process.env.NEXT_PUBLIC_APP_BASE_URL
			)
			window.location.assign(logoutUrl.toString())
		}
	}, [searchParams, router, pathname, posthog]) // Dependencies are correct

	// ... (keep the rest of your useEffects and functions exactly as they were)
	useEffect(() => {
		if (!showNav) {
			setIsLoading(false)
			setIsAllowed(true)
			return
		}

		if (isAuthLoading) return

		if (authError) {
			toast.error("Session error. Redirecting to login.", {
				id: "auth-error"
			})
			router.push("/auth/login")
			return
		}

		if (!user) {
			// This handles the case where the user logs out.
			router.push("/auth/login")
			return
		}

		const checkStatus = async () => {
			// No need to set isLoading(true) here, it's already true by default.
			try {
				const res = await fetch("/api/user/data", { method: "POST" })
				if (!res.ok) throw new Error("Could not verify user status.")
				const result = await res.json()
				const data = result?.data || {}

				const onboardingComplete = data.onboardingComplete
				const needsDataCompletion = data.needsDataCompletion

				if (!onboardingComplete) {
					toast.error("Please complete onboarding first.", {
						id: "onboarding-check"
					})
					router.push("/onboarding")
				} else if (needsDataCompletion) {
					// User is onboarded but is missing the new required fields.
					// Force them to the completion page from anywhere else.
					if (pathname !== "/complete-profile") {
						router.push("/complete-profile")
					} else {
						// If they are already on the correct page, allow it to render.
						setIsAllowed(true)
					}
				} else {
					// User is fully onboarded and profile is complete.
					setIsAllowed(true)
				}
			} catch (error) {
				toast.error(error.message)
				router.push("/")
			} finally {
				setIsLoading(false)
			}
		}

		checkStatus()
	}, [pathname, router, showNav, user, authError, isAuthLoading]) // Reruns on navigation

	const handleNotificationsOpen = useCallback(() => {
		setNotificationsOpen(true)
		setUnreadCount(0)
	}, [])

	// ... (keep the rest of your useEffects and functions exactly as they were)
	useEffect(() => {
		if (!user?.sub) return

		const connectWebSocket = async () => {
			if (wsRef.current && wsRef.current.readyState < 2) return

			try {
				const tokenResponse = await fetch("/api/auth/token")
				if (!tokenResponse.ok) {
					setTimeout(connectWebSocket, 5000)
					return
				}
				const { accessToken } = await tokenResponse.json()
				const wsProtocol =
					window.location.protocol === "https:" ? "wss" : "ws"
				const serverUrlHttp =
					process.env.NEXT_PUBLIC_APP_SERVER_URL ||
					"http://localhost:5000"
				const serverHost = serverUrlHttp.replace(/^https?:\/\//, "")
				const wsUrl = `${wsProtocol}://${serverHost}/api/ws/notifications`

				const ws = new WebSocket(wsUrl)
				ws.isCleaningUp = false
				wsRef.current = ws

				ws.onopen = () =>
					ws.send(
						JSON.stringify({ type: "auth", token: accessToken })
					)
				ws.onmessage = (event) => {
					const data = JSON.parse(event.data)
					if (data.type === "new_notification") {
						setUnreadCount((prev) => prev + 1)
						setNotifRefreshKey((prev) => prev + 1)
						toast(
							(t) => (
								<div className="flex items-center gap-3">
									<span className="flex-1">
										{data.notification.message}
									</span>
									<button
										onClick={() => {
											handleNotificationsOpen()
											toast.dismiss(t.id)
										}}
										className="py-1 px-3 rounded-md bg-brand-orange text-black text-sm font-semibold"
									>
										View
									</button>
									<button
										onClick={() => toast.dismiss(t.id)}
										className="p-1.5 rounded-full hover:bg-neutral-700"
									>
										<IconX size={16} />
									</button>
								</div>
							),
							{
								duration: 6000
							}
						)
					} else if (data.type === "task_progress_update") {
						// Dispatch a custom event that the tasks page can listen for
						window.dispatchEvent(
							new CustomEvent("taskProgressUpdate", {
								detail: data.payload
							})
						)
					} else if (data.type === "task_list_updated") {
						window.dispatchEvent(
							new CustomEvent("tasksUpdatedFromBackend")
						)
					}
				}
				ws.onclose = () => {
					if (!ws.isCleaningUp) {
						wsRef.current = null
						setTimeout(connectWebSocket, 5000)
					}
				}
				ws.onerror = () => ws.close()
			} catch (error) {
				setTimeout(connectWebSocket, 5000)
			}
		}
		connectWebSocket()

		return () => {
			if (wsRef.current) {
				wsRef.current.isCleaningUp = true
				wsRef.current.close()
				wsRef.current = null
			}
		}
	}, [user?.sub, handleNotificationsOpen])

	

	// PWA Update Handler

	useEffect(() => {
		// This effect runs only on the client side to register the service worker.
		// It's enabled for all environments to allow testing in development.
		if ("serviceWorker" in navigator) {
			// The 'load' event ensures that SW registration doesn't delay page rendering.
			window.addEventListener("load", function () {
				navigator.serviceWorker.register("/sw.js").then(
					function (registration) {},
					function (err) {
						console.error(
							"ServiceWorker registration failed: ",
							err
						)
					}
				)
			})
		}
	}, [])

	// PWA Update Handler
	useEffect(() => {
		if (
			typeof window !== "undefined" &&
			"serviceWorker" in navigator &&
			window.workbox !== undefined
		) {
			const wb = window.workbox

			const promptNewVersionAvailable = (event) => {
				if (!event.wasWaitingBeforeRegister) {
					toast(
						(t) => (
							<div className="flex flex-col items-center gap-2 text-white">
								<span>A new version is available!</span>
								<div className="flex gap-2">
									<button
										className="py-1 px-3 rounded-md bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
										onClick={() => {
											wb.addEventListener(
												"controlling",
												() => {
													window.location.reload()
												}
											)
											wb.messageSkipWaiting()
											toast.dismiss(t.id)
										}}
									>
										Refresh
									</button>
									<button
										className="py-1 px-3 rounded-md bg-neutral-600 hover:bg-neutral-500 text-white text-sm font-medium"
										onClick={() => toast.dismiss(t.id)}
									>
										Dismiss
									</button>
								</div>
							</div>
						),
						{ duration: Infinity }
					)
				}
			}

			wb.addEventListener("waiting", promptNewVersionAvailable)
			return () => {
				wb.removeEventListener("waiting", promptNewVersionAvailable)
			}
		}
	}, [])

	const subscribeToPushNotifications = useCallback(async () => {
		if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
			return
		}
		if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
			console.warn(
				"VAPID public key not configured. Skipping push subscription."
			)
			return
		}

		try {
			const registration = await navigator.serviceWorker.ready
			let subscription = await registration.pushManager.getSubscription()

			if (subscription === null) {
				const permission = await window.Notification.requestPermission()
				if (permission !== "granted") {
					console.log("Notification permission not granted.")
					return
				}

				const applicationServerKey = urlBase64ToUint8Array(
					process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
				)

				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey
				})

				const serializedSub = JSON.parse(JSON.stringify(subscription))
				await subscribeUser(serializedSub)
				toast.success("Subscribed to push notifications!")
			}
		} catch (error) {
			console.error("Error during push notification subscription:", error)
			toast.error("Failed to subscribe to push notifications.")
		}
	}, [])

	useEffect(() => {
		if (showNav && userDetails?.sub) subscribeToPushNotifications()
	}, [showNav, userDetails, subscribeToPushNotifications])

	// Define shortcuts after all their callback dependencies are defined
	useGlobalShortcuts(
		handleNotificationsOpen,
		() => setSearchOpen(true) // New: Pass search open function
		// Removed: Command palette toggle is no longer needed
	)

	if (isLoading || isAuthLoading) {
		return (
			<div className="flex-1 flex h-screen bg-black text-white overflow-hidden justify-center items-center">
				<IconLoader className="w-10 h-10 animate-spin text-brand-orange" />
			</div>
		)
	}

	if (!isAllowed) {
		return (
			<div className="flex-1 flex h-screen bg-black text-white overflow-hidden justify-center items-center">
				<IconLoader className="w-10 h-10 animate-spin text-brand-orange" />
			</div>
		)
	}

	// ... (rest of the component is unchanged)
	return (
		<PlanContext.Provider
			value={{
				plan: (
					user?.[
						`${process.env.NEXT_PUBLIC_AUTH0_NAMESPACE}/roles`
					] || []
				).includes("Pro")
					? "pro"
					: "free",
				isPro: (
					user?.[
						`${process.env.NEXT_PUBLIC_AUTH0_NAMESPACE}/roles`
					] || []
				).includes("Pro"),
				isLoading: isAuthLoading
			}}
		>
			<TourContext.Provider value={tourValue}>
				{showNav && (
					<>
						<Sidebar
							onNotificationsOpen={handleNotificationsOpen}
							onSearchOpen={() => setSearchOpen(true)}
							unreadCount={unreadCount}
							isMobileOpen={isMobileNavOpen}
							onMobileClose={() => setMobileNavOpen(false)}
							user={user}
						/>
						<button
							onClick={() => setMobileNavOpen(true)}
							className="md:hidden fixed top-4 left-4 z-30 p-2 rounded-full bg-neutral-800/50 backdrop-blur-sm text-white"
						>
							<IconMenu2 size={20} />
						</button>
					</>
				)}
				<div
					className={cn(
						"flex-1 transition-[padding-left] duration-300 ease-in-out",
						showNav && "md:pl-[260px]"
					)}
				>
					{children}
				</div>
				<AnimatePresence>
					{isNotificationsOpen && (
						<NotificationsOverlay
							notifRefreshKey={notifRefreshKey}
							onClose={() => setNotificationsOpen(false)}
						/>
					)}
				</AnimatePresence>
				<AnimatePresence>
					{isSearchOpen && (
						<GlobalSearch onClose={() => setSearchOpen(false)} />
					)}
				</AnimatePresence>
				<GuidedTour />
			</TourContext.Provider>
		</PlanContext.Provider>
	)
}
