"use client"

import { useEffect, useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Custom hook to manage global keyboard shortcuts.
 * It intelligently adds/removes listeners based on the current route.
 * @param {function} onNotificationsOpen - Callback to open notifications.
 * @param {function} onSearchOpen - Callback to open the global search.
 */
export function useGlobalShortcuts(onNotificationsOpen, onSearchOpen) {
	const router = useRouter()
	const pathname = usePathname()

	// Shortcuts are disabled on these routes
	const isDisabled = ["/", "/onboarding"].includes(pathname)

	const handleKeyDown = useCallback(
		(e) => {
			// Use e.code for physical key presses, ignoring layout/shift changes for the key itself
			if (e.ctrlKey) {
				if (e.shiftKey) {
					switch (e.code) {
						case "Digit1":
							router.push("/chat")
							break
						case "Digit2":
							router.push("/tasks")
							break
						case "Digit3":
							router.push("/memories")
							break
						case "Digit4":
							router.push("/integrations")
							break
						case "Digit5":
							router.push("/settings")
							break
						case "KeyE": // E for Events/Notifications
							onNotificationsOpen()
							break
						default:
							return
					}
				} else {
					switch (e.code) {
						case "KeyK": // K for Kommand/Search
							onSearchOpen()
							break
						default:
							return
					}
				}
				e.preventDefault()
			}
		},
		[router, onNotificationsOpen, onSearchOpen]
	)

	useEffect(() => {
		if (isDisabled) return

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [isDisabled, handleKeyDown])
}
