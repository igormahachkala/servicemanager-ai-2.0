import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { MulterError } from 'multer'

export const PUBLIC_UPLOAD_MAX_FILE_BYTES = 10 * 1024 * 1024
export const PUBLIC_UPLOAD_MAX_FILES = 3
export const PUBLIC_UPLOAD_MAX_FIELDS = 20
export const PUBLIC_UPLOAD_MAX_FIELD_BYTES = 8 * 1024

export class PublicUploadTypeError extends Error {
  constructor() {
    super('Unsupported photo format')
  }
}

export function publicUploadFileFilter(
  _req: unknown,
  file: { mimetype?: string },
  cb: (error: Error | null, accept: boolean) => void,
) {
  const mime = String(file.mimetype || '').toLowerCase()
  if (!mime.startsWith('image/')) {
    cb(new PublicUploadTypeError(), false)
    return
  }
  cb(null, true)
}

export const publicPhotoUploadOptions = {
  limits: {
    fileSize: PUBLIC_UPLOAD_MAX_FILE_BYTES,
    files: PUBLIC_UPLOAD_MAX_FILES,
    fields: PUBLIC_UPLOAD_MAX_FIELDS,
    fieldSize: PUBLIC_UPLOAD_MAX_FIELD_BYTES,
  },
  fileFilter: publicUploadFileFilter,
}

export function mapPublicUploadError(error: unknown): HttpException | null {
  if (error instanceof PublicUploadTypeError) {
    return new HttpException('Unsupported photo format', HttpStatus.BAD_REQUEST)
  }
  if (error instanceof MulterError && (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FIELD_VALUE')) {
    return new HttpException('Upload is too large', HttpStatus.PAYLOAD_TOO_LARGE)
  }
  return null
}

@Catch(MulterError, PublicUploadTypeError)
export class PublicUploadExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const mapped = mapPublicUploadError(exception)
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void }
    }>()
    if (!mapped) {
      response.status(HttpStatus.BAD_REQUEST).json({ statusCode: HttpStatus.BAD_REQUEST, message: 'Upload rejected' })
      return
    }
    const body = mapped.getResponse()
    response.status(mapped.getStatus()).json(typeof body === 'string' ? { statusCode: mapped.getStatus(), message: body } : body)
  }
}
