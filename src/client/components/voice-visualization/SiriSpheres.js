"use client"
import React, { useRef, useMemo, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Color } from "three"

const Ring = ({ color, initialRotation, reactionIntensity = 0 }) => {
	const ringRef = useRef()

	useFrame(({ clock }) => {
		if (ringRef.current) {
			const t = clock.getElapsedTime()
			// Apply a slow, continuous base rotation
			ringRef.current.rotation.x = initialRotation[0] + t * 0.1
			ringRef.current.rotation.y = initialRotation[1] + t * 0.2
			ringRef.current.rotation.z = initialRotation[2] + t * 0.15

			// Add reaction wobble
			if (reactionIntensity > 0) {
				ringRef.current.rotation.x +=
					Math.sin(t * 20) * reactionIntensity * 0.3
				ringRef.current.rotation.y +=
					Math.cos(t * 25) * reactionIntensity * 0.2
			}
		}
	})

	return (
		<group ref={ringRef}>
			{/** Core ring */}
			<mesh>
				<torusGeometry args={[1.2, 0.055, 64, 200]} />
				<meshPhysicalMaterial
					color={color}
					emissive={color}
					emissiveIntensity={0.55}
					transmission={0}
					roughness={0.35}
					metalness={0.05}
					thickness={0}
					ior={1.0}
					transparent
					opacity={0.95}
				/>
			</mesh>

			{/** Faux-bloom outer glow */}
			<mesh scale={[1.04, 1.04, 1.04]}>
				<torusGeometry args={[1.2, 0.095, 64, 200]} />
				<meshBasicMaterial
					color={color}
					transparent
					opacity={0.25}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
		</group>
	)
}

const Scene = ({ status, audioLevel = 0, reactionIntensity = 0 }) => {
	const groupRef = useRef()
	const scale = useRef(1)
	const velocity = useRef(0)
	const dullOrange = useMemo(() => new Color("#8B5F11"), [])
	const brandOrange = useMemo(() => new Color("#F1A21D"), [])

	const [ringColors, setRingColors] = useState(() => [
		new Color("#8B5F11"),
		new Color("#8B5F11"),
		new Color("#8B5F11")
	])

	useFrame(({ clock }) => {
		const t = clock.getElapsedTime()

		setRingColors((prevColors) => {
			const newColors = prevColors.map((color) => color.clone())

			if (status === "disconnected") {
				newColors.forEach((c) => c.copy(dullOrange))
			} else if (status === "connecting") {
				const colorFactor = (Math.sin(t * 3) + 1) / 2 // Slower oscillation
				newColors.forEach((c) => {
					c.lerpColors(dullOrange, brandOrange, colorFactor)
				})
			} else if (status === "connected") {
				newColors.forEach((c) => {
					c.lerp(brandOrange, 0.05) // Slower transition
				})
			}

			return newColors
		})

		// Scale logic
		let targetScale = 1
		if (status === "connecting") {
			targetScale = 1 + Math.sin(t * 4) * 0.2
		} else if (status === "connected") {
			// Clamp the audio level's effect to prevent excessive scaling
			targetScale =
				1 + Math.min(audioLevel, 1.0) * 0.5 + reactionIntensity * 0.8
		}

		// Spring physics for a more natural animation
		const stiffness = 0.15 // How springy it is
		const damping = 0.2 // How much it resists motion

		const force = stiffness * (targetScale - scale.current)
		velocity.current = (velocity.current + force) * (1 - damping)
		scale.current += velocity.current

		// Settle if very close to target to prevent endless small movements
		if (
			Math.abs(scale.current - targetScale) < 0.001 &&
			Math.abs(velocity.current) < 0.001
		) {
			scale.current = targetScale
			velocity.current = 0
		}

		if (groupRef.current) {
			groupRef.current.scale.setScalar(scale.current)
		}
	})

	const ringConfigs = useMemo(
		() => [
			{ initialRotation: [Math.PI / 2, 0, 0] },
			{ initialRotation: [0, Math.PI / 2, Math.PI / 4] },
			{ initialRotation: [Math.PI / 4, Math.PI / 4, Math.PI / 2] }
		],
		[]
	)

	return (
		<>
			<ambientLight intensity={0.2} />
			<pointLight position={[5, 5, 5]} intensity={0.5} />
			<pointLight position={[-5, -5, -5]} intensity={0.3} />
			<group ref={groupRef}>
				{ringConfigs.map((config, i) => (
					<Ring
						key={i}
						color={ringColors[i]}
						initialRotation={config.initialRotation}
						reactionIntensity={reactionIntensity}
					/>
				))}
			</group>
		</>
	)
}

const SiriSpheres = ({ status, audioLevel = 0, reactionIntensity = 0 }) => {
	return (
		<Canvas
			className="w-full h-full"
			camera={{ position: [0, 0, 5], fov: 50 }}
			gl={{
				alpha: true,
				antialias: true,
				outputColorSpace: THREE.SRGBColorSpace,
				toneMapping: THREE.ACESFilmicToneMapping,
				toneMappingExposure: 1.05
			}}
		>
			<Scene
				status={status}
				audioLevel={audioLevel}
				reactionIntensity={reactionIntensity}
			/>
		</Canvas>
	)
}

export default SiriSpheres
