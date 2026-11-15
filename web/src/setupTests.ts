import '@testing-library/jest-dom'

// jsdom has no layout, so it cannot scroll.
window.scrollTo = jest.fn()
