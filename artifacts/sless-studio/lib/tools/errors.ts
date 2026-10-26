/**
 * A tool failure with a message safe to show the user (it lands on the failed
 * tile, followed by "Credits refunded.") and an optional detail for the logs.
 */
export class ToolError extends Error {
  constructor(
    readonly userMessage: string,
    readonly operatorDetail?: string
  ) {
    super(operatorDetail ?? userMessage)
    this.name = "ToolError"
  }
}
