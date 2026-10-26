/** Errors whose message is written for users and safe to show. */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly code = "BAD_REQUEST"
  ) {
    super(message)
    this.name = "UserFacingError"
  }
}

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED"
  constructor(message = "Sign in to continue.") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

/** Also used for other users' ids so existence never leaks (404, not 403). */
export class NotFoundError extends Error {
  readonly code = "NOT_FOUND"
  constructor(message = "Not found.") {
    super(message)
    this.name = "NotFoundError"
  }
}
