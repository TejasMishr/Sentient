"use client"
import React from "react"
import { motion } from "framer-motion"
import {
	IconMessageCircle,
	IconPhone,
	IconBriefcase,
	IconCalendar,
	IconMail,
	IconFileText,
	IconBrandWhatsapp,
	IconBrandGoogleDrive,
	IconBrandGmail,
	IconBrain
} from "@tabler/icons-react"

const iconSets = {
	communication: [
		{ icon: IconMessageCircle, position: { x: 25, y: 25 } },
		{ icon: IconPhone, position: { x: 75, y: 25 } }
	],
	work: [
		{ icon: IconBriefcase, position: { x: 15, y: 50 } },
		{ icon: IconCalendar, position: { x: 85, y: 25 } },
		{ icon: IconMail, position: { x: 20, y: 80 } },
		{ icon: IconFileText, position: { x: 80, y: 80 } }
	],
	integrations: [
		{ icon: IconBrandWhatsapp, position: { x: 20, y: 20 } },
		{ icon: IconBrandGoogleDrive, position: { x: 80, y: 20 } },
		{ icon: IconBrandGmail, position: { x: 15, y: 80 } },
		{ icon: IconMail, position: { x: 85, y: 80 } }
	],
	memory: [{ icon: IconBrain, position: { x: 50, y: 15 } }]
}

const FloatingIcon = ({ icon: Icon, position, isActive, delay = 0 }) => {
	return (
		<motion.div
			className="absolute"
			style={{
				left: `${position.x}%`,
				top: `${position.y}%`,
				transform: "translate(-50%, -50%)"
			}}
			initial={{ scale: 0, opacity: 0, rotate: 0 }}
			animate={{
				scale: 1,
				opacity: isActive ? 1 : 0.4,
				rotate: 360,
				y: [0, -10, 0]
			}}
			transition={{
				scale: { duration: 0.5, delay },
				opacity: { duration: 0.3, delay },
				rotate: { duration: 8, repeat: Infinity, ease: "linear" },
				y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
			}}
			exit={{ scale: 0, opacity: 0 }}
		>
			<div
				className={`p-5 rounded-full backdrop-blur-sm border transition-colors duration-300 ${
					isActive
						? "bg-brand-orange/20 border-brand-orange text-brand-orange"
						: "bg-neutral-800/20 border-neutral-600 text-neutral-400"
				}`}
			>
				<Icon size={36} />
			</div>
		</motion.div>
	)
}

const FloatingIcons = ({ currentStage, allStages = [] }) => {
	const renderIconsForStage = (stage, isActive) => {
		const icons = iconSets[stage] || []
		return icons.map((iconData, index) => (
			<FloatingIcon
				key={`${stage}-${index}`}
				icon={iconData.icon}
				position={iconData.position}
				isActive={isActive}
				delay={index * 0.1}
			/>
		))
	}

	return (
		<div className="absolute inset-0 pointer-events-none">
			{allStages.map((stage) => {
				const isActive = stage === currentStage
				return (
					<React.Fragment key={stage}>
						{renderIconsForStage(stage, isActive)}
					</React.Fragment>
				)
			})}
		</div>
	)
}

export default FloatingIcons
