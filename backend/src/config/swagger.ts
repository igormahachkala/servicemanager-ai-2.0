export function isSwaggerEnabled(raw = process.env.SWAGGER_ENABLED): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}
