import { config } from './config'

describe('config', () => {
  it('exposes the values injected at build time', () => {
    expect(config).toEqual({
      apiUrl: 'https://api.test',
      gatewayUrl: 'https://gateway.test/v1',
      gatewayPublicKey: 'pub_test_key',
    })
  })
})
