import { ValidationPipe } from '@nestjs/common';
import { RescheduleNextOccurrenceDto } from './reschedule-next-occurrence.dto';

const input = {
  nextDueAt: '2027-03-07T12:00:00.000Z',
  expectedNextDueAt: '2027-03-05T12:00:00.000Z',
  expectedUpdatedAt: '2027-03-01T12:00:00.000Z',
};
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const validate = (value: unknown) =>
  pipe.transform(value, {
    type: 'body',
    metatype: RescheduleNextOccurrenceDto,
  });

describe('RescheduleNextOccurrenceDto', () => {
  it('accepts exactly the target and both immutable guards with explicit timezone', async () => {
    await expect(validate(input)).resolves.toBeInstanceOf(
      RescheduleNextOccurrenceDto,
    );
    await expect(
      validate({ ...input, nextDueAt: '2027-03-07T15:00:00+03:00' }),
    ).resolves.toBeInstanceOf(RescheduleNextOccurrenceDto);
  });
  it.each(Object.keys(input))(
    'requires a strict offset-qualified %s',
    async (key) => {
      for (const value of [
        undefined,
        null,
        '',
        'bad',
        '2027-02-30T12:00:00Z',
        '2027-03-07',
        '2027-03-07T12:00:00',
      ]) {
        await expect(validate({ ...input, [key]: value })).rejects.toThrow();
      }
    },
  );
  it.each([
    'startDate',
    'frequency',
    'intervalDays',
    'graceDays',
    'leadTimeDays',
    'isActive',
    'assignedToUserId',
    'lastRunId',
  ])('cannot change %s through next-occurrence action', async (key) => {
    await expect(validate({ ...input, [key]: 'unexpected' })).rejects.toThrow();
  });
});
