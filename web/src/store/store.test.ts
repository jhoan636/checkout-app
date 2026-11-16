import { fakeServices } from '../test/render'

type DevToolsWindow = Window & { __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: unknown }

/**
 * Redux Toolkit looks for the browser extension when it is first loaded, so
 * each case loads the store again with the extension already in place.
 */
const createStoreWith = (devTools: boolean, connect: jest.Mock) => {
  ;(window as DevToolsWindow).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = connect
  jest.isolateModules(() => {
    const { config } = jest.requireActual<typeof import('../config')>('../config')
    config.devTools = devTools
    const { createAppStore } =
      jest.requireActual<typeof import('./store')>('./store')
    createAppStore(fakeServices())
  })
}

describe('createAppStore', () => {
  const connect = jest.fn(() => (...enhancers: unknown[]) => enhancers[0])

  afterEach(() => {
    delete (window as DevToolsWindow).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    connect.mockClear()
  })

  it('does not connect to Redux DevTools in a production build', () => {
    createStoreWith(false, connect)

    expect(connect).not.toHaveBeenCalled()
  })

  it('connects to Redux DevTools while developing', () => {
    createStoreWith(true, connect)

    expect(connect).toHaveBeenCalled()
  })
})
