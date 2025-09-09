// This file is automatically run before each test.
import "@testing-library/jest-dom"

// Mock fetch globally for all tests
global.fetch = jest.fn()
