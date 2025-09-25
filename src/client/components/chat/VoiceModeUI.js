"use client"

import {
	IconPhone,
	IconPhoneOff,
	IconMicrophone,
	IconMicrophoneOff,
	IconMessageOff,
	IconLoader
} from "@tabler/icons-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@utils/cn"
import SiriSpheres from "@components/voice/SiriSpheres"
import { TextShimmer } from "@components/ui/text-shimmer"
import { Button } from "@components/ui/button"

const VoiceModeUI = ({
	connectionStatus,
	audioLevel,
	selectedAudioInputDevice,
	setSelectedAudioInputDevice,
	audioInputDevices,
	isMuted,
	handleToggleMute,
	handleStartVoice,
	handleStopVoice,
	toggleVoiceMode,
	voiceStatusText,
	displayedMessages
}) => {
	return (
		<div className="flex-1 flex flex-col -translate-y-12 relative overflow-hidden">
			{/* The 3D visualization will render here as a background */}
			<SiriSpheres status={connectionStatus} audioLevel={audioLevel} />

			{/* Overlay for controls and status text */}
			<div className="absolute inset-0 z-20 flex flex-col translate-y-20 items-center justify-end p-4 pb-8 sm:p-6 sm:pb-12">
				{/* Call Control Bar */}
				<div className="flex items-center justify-center gap-2 sm:gap-4 p-3 bg-neutral-900/50 backdrop-blur-md rounded-full border border-neutral-700/50 shadow-lg mb-6">
					{/* Mic Selector */}
					<select
						value={selectedAudioInputDevice}
						onChange={(e) =>
							setSelectedAudioInputDevice(e.target.value)
						}
						className="bg-brand-gray backdrop-blur-sm border border-brand-gray text-brand-white text-sm rounded-full px-4 py-4 focus:outline-none focus:border-brand-orange appearance-none max-w-[120px] sm:max-w-[150px] truncate shadow-lg"
						title="Select Microphone"
						disabled={connectionStatus !== "disconnected"}
					>
						{audioInputDevices.length === 0 ? (
							<option value="">No mics found</option>
						) : (
							audioInputDevices.map((device) => (
								<option
									key={device.deviceId}
									value={device.deviceId}
								>
									{device.label}
								</option>
							))
						)}
					</select>

					{/* Mute Button */}
					<AnimatePresence>
						{connectionStatus === "connected" && (
							<motion.button
								initial={{
									opacity: 0,
									scale: 0
								}}
								animate={{
									opacity: 1,
									scale: 1
								}}
								exit={{ opacity: 0, scale: 0 }}
								onClick={handleToggleMute}
								className={cn(
									"flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors duration-200",
									isMuted
										? "bg-white text-black"
										: "bg-neutral-700 hover:bg-neutral-600"
								)}
								title={isMuted ? "Unmute" : "Mute"}
							>
								{isMuted ? (
									<IconMicrophoneOff size={24} />
								) : (
									<IconMicrophone size={24} />
								)}
							</motion.button>
						)}
					</AnimatePresence>

					{/* Main Call/End Button */}
					{connectionStatus === "disconnected" ? (
						<Button
							onClick={handleStartVoice}
							size="icon"
							className="h-12 w-12 rounded-full bg-brand-green text-white shadow-lg hover:bg-brand-green/80"
							title="Start Call"
						>
							<IconPhone size={24} />
						</Button>
					) : connectionStatus === "connecting" ? (
						<div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-brand-yellow text-brand-black shadow-lg">
							<IconLoader size={24} className="animate-spin" />
						</div>
					) : (
						<Button
							onClick={handleStopVoice}
							variant="destructive"
							size="icon"
							className="h-12 w-12 rounded-full"
							title="Hang Up"
						>
							<IconPhoneOff size={24} />
						</Button>
					)}

					{/* Switch to Text Mode Button */}
					<Button
						onClick={toggleVoiceMode}
						variant="secondary"
						size="icon"
						className="h-12 w-12 rounded-full bg-brand-gray hover:bg-neutral-600"
						title="Switch to Text Mode"
					>
						<IconMessageOff size={24} />
					</Button>
				</div>

				{/* Status and Message Display (below controls) */}
				<div className="text-center space-y-2 max-w-2xl">
					<div className="text-base sm:text-lg font-medium text-gray-300 min-h-[24px]">
						<AnimatePresence mode="wait">
							<motion.div
								key={voiceStatusText}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10 }}
								transition={{ duration: 0.2 }}
							>
								<TextShimmer className="font-mono text-base">
									{voiceStatusText}
								</TextShimmer>
							</motion.div>
						</AnimatePresence>
					</div>
					<div className="text-xl sm:text-2xl font-semibold text-white min-h-[64px]">
						<AnimatePresence mode="wait">
							{displayedMessages
								.filter((m) => m.role === "user")
								.slice(-1)
								.map((msg) => (
									<motion.div
										key={msg.id}
										initial={{
											opacity: 0,
											y: 15
										}}
										animate={{
											opacity: 1,
											y: 0
										}}
										exit={{
											opacity: 0,
											y: -15
										}}
										transition={{
											duration: 0.3
										}}
									>
										{msg.content}
									</motion.div>
								))}
						</AnimatePresence>
					</div>
				</div>
			</div>
		</div>
	)
}

export default VoiceModeUI
