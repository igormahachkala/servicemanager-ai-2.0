import { extractMaxIncomingMedia, MaxFileClient } from './max-file.client';

describe('MaxFileClient', () => {
  it('reads image payload.url from a MAX message body', () => {
    expect(
      extractMaxIncomingMedia({
        message: {
          body: {
            attachments: [{ type: 'image', payload: { url: 'https://cdn.example/a.jpg', size: 12 } }],
          },
        },
      }),
    ).toEqual([
      {
        url: 'https://cdn.example/a.jpg',
        token: null,
        type: 'image',
        filename: '',
        size: 12,
        mime: null,
      },
    ]);
  });

  it('skips inline keyboards and downloads a bounded file', async () => {
    expect(
      extractMaxIncomingMedia({
        message: { attachments: [{ type: 'inline_keyboard', payload: { buttons: [] } }] },
      }),
    ).toEqual([]);

    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === 'content-type' ? 'image/jpeg' : '4') },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    });
    const client = new MaxFileClient('https://platform-api2.max.ru', 'token', fetchImpl as any);
    await expect(
      client.download({
        url: 'https://cdn.example/a.jpg',
        token: null,
        type: 'image',
        filename: 'shot.jpg',
        size: 4,
        mime: null,
      }),
    ).resolves.toMatchObject({ size: 4, mimetype: 'image/jpeg', originalname: 'shot.jpg' });
    expect(fetchImpl).toHaveBeenCalledWith('https://cdn.example/a.jpg');
  });

  it('keeps several images from one message and drops duplicates copied onto the root', () => {
    const image = { type: 'image', payload: { url: 'https://cdn.example/a.jpg', size: 12 } };
    expect(
      extractMaxIncomingMedia({
        message: {
          body: {
            attachments: [
              image,
              { type: 'image', payload: { url: 'https://cdn.example/b.jpg', size: 8 } },
            ],
          },
          attachments: [image],
        },
      }).map((item) => item.url),
    ).toEqual(['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg']);
  });

  it('rejects files over 10 MB before download', async () => {
    const client = new MaxFileClient('https://platform-api2.max.ru', 'token', jest.fn() as any);
    await expect(
      client.download({
        url: 'https://cdn.example/big.jpg',
        token: null,
        type: 'image',
        filename: 'big.jpg',
        size: 10 * 1024 * 1024 + 1,
        mime: 'image/jpeg',
      }),
    ).rejects.toThrow('Файл больше 10 МБ');
  });

  it('uploads an image via /uploads then posts token to /messages', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://upload.example/put' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ photos: { abc: { token: 'img-token-1' } } }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const client = new MaxFileClient('https://platform-api2.max.ru', 'bot-token', fetchImpl as any);
    await expect(client.uploadImage(Buffer.from([1, 2, 3]), 'memo.png')).resolves.toBe('img-token-1');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://platform-api2.max.ru/uploads?type=image',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchImpl.mock.calls[1][0]).toBe('https://upload.example/put');
    expect(fetchImpl.mock.calls[1][1].body).toBeInstanceOf(FormData);

    await client.sendImageMessage(99, 'Сегодня техника', 'img-token-1');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'https://platform-api2.max.ru/messages?chat_id=99',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: 'Сегодня техника',
          attachments: [{ type: 'image', payload: { token: 'img-token-1' } }],
        }),
      }),
    );
    expect(String(fetchImpl.mock.calls[2][1].body)).not.toContain('file://');
  });
});
