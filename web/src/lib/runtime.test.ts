import { newId, wait } from './runtime'

describe('runtime', () => {
  describe('newId', () => {
    it('gives a UUID, which the API requires as idempotency key', () => {
      expect(newId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
    })

    it('never repeats', () => {
      expect(newId()).not.toBe(newId())
    })
  })

  describe('wait', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('resolves only after the time has passed', async () => {
      const done = jest.fn()
      void wait(2_000).then(done)

      await jest.advanceTimersByTimeAsync(1_999)
      expect(done).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(1)
      expect(done).toHaveBeenCalledTimes(1)
    })
  })
})
