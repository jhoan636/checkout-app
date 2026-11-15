/**
 * The two things the store needs from the browser itself. They are passed in
 * as services, so tests replace them with a known id and no waiting.
 */

/** A random UUID from the browser's cryptographic generator. */
export const newId = (): string => crypto.randomUUID()

export const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
