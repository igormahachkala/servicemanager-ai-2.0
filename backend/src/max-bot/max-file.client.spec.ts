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
});
