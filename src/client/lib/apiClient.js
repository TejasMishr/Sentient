"use client"

/**
 * A standardized error class for API client errors.
 */
export class ApiError extends Error {
	constructor(message, status) {
		super(message)
		this.name = "ApiError"
		this.status = status
	}
}

/**
 * A centralized API client for making fetch requests from the client-side
 * to the Next.js API routes. It standardizes error handling and response parsing.
 *
 * @param {string} endpoint - The API route endpoint (e.g., '/api/chat/message').
 * @param {object} options - The options object for the fetch call.
 * @param {string} [options.responseType='json'] - The expected response type ('json', 'blob', 'text', 'raw').
 * @returns {Promise<any>} The parsed response.
 * @throws {ApiError} - Throws an ApiError if the request fails.
 */
async function apiClient(endpoint, options = {}) {
	const { responseType = "json", ...fetchOptions } = options

	const headers = {
		"Content-Type": "application/json",
		...fetchOptions.headers
	}

	if (options.body instanceof FormData) {
		delete headers["Content-Type"]
	}

	const response = await fetch(endpoint, {
		...fetchOptions,
		headers
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}))
		const message =
			errorData.detail ||
			errorData.error ||
			errorData.message ||
			`Request failed with status ${response.status}`
		throw new ApiError(message, response.status)
	}

	if (responseType === "raw") {
		return response
	}

	if (response.status === 204) {
		return null
	}

	if (responseType === "blob") {
		return response.blob()
	}

	if (responseType === "text") {
		return response.text()
	}

	return response.json()
}

export default apiClient