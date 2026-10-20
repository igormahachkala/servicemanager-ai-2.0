import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

/** Canonical 8-4-4-4-12 hex UUID (any version nibble, incl. Stage deterministic ids). */
export const CANONICAL_UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export function isCanonicalUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return trimmed.length > 0 && CANONICAL_UUID_PATTERN.test(trimmed)
}

type IsCanonicalUuidOptions = {
  each?: boolean
}

@ValidatorConstraint({ name: 'isCanonicalUuid', async: false })
export class IsCanonicalUuidConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === null || value === undefined) return true

    const options = (args.constraints[0] ?? {}) as IsCanonicalUuidOptions
    if (options.each) {
      if (!Array.isArray(value)) return false
      return value.every((item) => item === null || item === undefined || isCanonicalUuid(item))
    }

    return isCanonicalUuid(value)
  }

  defaultMessage(): string {
    return 'must be a canonical UUID'
  }
}

export function IsCanonicalUuid(
  options?: IsCanonicalUuidOptions & ValidationOptions,
): PropertyDecorator {
  const { each, ...validationOptions } = options ?? {}
  return function register(object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [{ each: !!each }],
      validator: IsCanonicalUuidConstraint,
    })
  }
}
