module.exports = {
	testEnvironment: "jest-environment-jsdom",
	setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
	transform: {
		"^.+\\.(js|jsx)$": ["babel-jest", { presets: ["next/babel"] }]
	},
	moduleNameMapper: {
		"^@components/(.*)$": "<rootDir>/components/$1",
		"^@hooks/(.*)$": "<rootDir>/hooks/$1",
		"^@stores/(.*)$": "<rootDir>/stores/$1",
		"^@utils/(.*)$": "<rootDir>/utils/$1",
		"^@lib/(.*)$": "<rootDir>/lib/$1",
		"^@app/(.*)$": "<rootDir>/app/$1"
	}
}
