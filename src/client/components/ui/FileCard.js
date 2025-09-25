"use client"

import React from "react"
import { IconFile, IconDownload, IconLoader } from "@tabler/icons-react"
import { cn } from "@utils/cn"
import toast from "react-hot-toast"
import { useMutation } from "@tanstack/react-query"

const FileCard = ({ filename }) => {
	const downloadFileMutation = useMutation({
		mutationFn: async (fname) => {
			const response = await fetch(
				`/api/files/download/${encodeURIComponent(fname)}`
			)
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement("a")
			a.href = url
			a.download = fname
			document.body.appendChild(a)
			a.click()
			a.remove()
			window.URL.revokeObjectURL(url)
		},
		onSuccess: () => {
			toast.success(`${filename} downloaded.`)
		},
		onError: (error) => {
			toast.error(`Error: ${error.message}`)
		}
	})

	const handleDownload = () => {
		downloadFileMutation.mutate(filename)
	}

	return (
		<div
			className={cn(
				"my-2 flex items-center justify-between gap-3 rounded-lg border border-neutral-700 bg-neutral-800/60 p-3"
			)}
		>
			<div className="flex items-center gap-3 overflow-hidden">
				<IconFile
					size={24}
					className="flex-shrink-0 text-neutral-400"
				/>
				<span
					className="truncate font-mono text-sm text-white"
					title={filename}
				>
					{filename}
				</span>
			</div>
			<button
				onClick={handleDownload}
				disabled={downloadFileMutation.isPending}
				className="flex-shrink-0 rounded-md bg-blue-600 p-2 text-white hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed"
				title={`Download ${filename}`}
			>
				{downloadFileMutation.isPending ? (
					<IconLoader size={16} className="animate-spin" />
				) : (
					<IconDownload size={16} />
				)}
			</button>
		</div>
	)
}

export default FileCard
