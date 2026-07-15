const JWT_SECRET_MIN_LENGTH = 32

/**
 * Reads a required environment variable and throws at call-site if it is
 * absent or (optionally) too short.  Never provides a fallback value.
 */
export function getRequiredEnv(name: string, options?: { minLength?: number }): string {
  const value = (process.env[name] ?? '').trim()
  if (!value) {
    throw new Error(
      `Required environment variable "${name}" is not set. ` +
        `Add it to your .env file before starting the application.`,
    )
  }
  if (options?.minLength !== undefined && value.length < options.minLength) {
    throw new Error(
      `Environment variable "${name}" must be at least ${options.minLength} characters ` +
        `(got ${value.length}). Generate a strong value with: openssl rand -hex 32`,
    )
  }
  return value
}

/**
 * Returns the validated JWT secret.
 * Throws at call-site — either at module load (auth.module / jwt.strategy)
 * or at the explicit fail-fast call in main.ts — before the server binds a port.
 */
export function getJwtSecret(): string {
  return getRequiredEnv('JWT_SECRET', { minLength: JWT_SECRET_MIN_LENGTH })
}
