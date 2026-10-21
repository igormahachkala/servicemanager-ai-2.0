import { HttpStatus } from '@nestjs/common'
import { MulterError } from 'multer'

import { mapPublicUploadError, publicUploadFileFilter, PublicUploadTypeError } from './public-request-upload'

describe('public upload limits', () => {
  it('maps a file over the size limit to 413', () => {
    const error = new MulterError('LIMIT_FILE_SIZE')
    const mapped = mapPublicUploadError(error)
    expect(mapped?.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE)
  })

  it('maps a non-image file to 400', () => {
    const mapped = mapPublicUploadError(new PublicUploadTypeError())
    expect(mapped?.getStatus()).toBe(HttpStatus.BAD_REQUEST)
  })

  it('rejects a non-image in the multer filter', () => {
    const cb = jest.fn()
    publicUploadFileFilter({}, { mimetype: 'application/pdf' }, cb)
    expect(cb).toHaveBeenCalledWith(expect.any(PublicUploadTypeError), false)
  })

  it('accepts an image in the multer filter', () => {
    const cb = jest.fn()
    publicUploadFileFilter({}, { mimetype: 'image/png' }, cb)
    expect(cb).toHaveBeenCalledWith(null, true)
  })
})
