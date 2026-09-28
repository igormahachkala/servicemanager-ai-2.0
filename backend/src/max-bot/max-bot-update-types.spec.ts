import { MAX_BOT_COMMAND_UPDATE_TYPES, resolveMaxBotUpdateTypes } from './max-bot.types';

describe('resolveMaxBotUpdateTypes', () => {
  const previous = process.env.MAX_BOT_UPDATE_TYPES;

  afterEach(() => {
    if (previous === undefined) delete process.env.MAX_BOT_UPDATE_TYPES;
    else process.env.MAX_BOT_UPDATE_TYPES = previous;
  });

  it('uses the default list when the variable is missing or blank', () => {
    delete process.env.MAX_BOT_UPDATE_TYPES;
    expect(resolveMaxBotUpdateTypes()).toEqual([...MAX_BOT_COMMAND_UPDATE_TYPES]);
    expect(resolveMaxBotUpdateTypes('')).toEqual([...MAX_BOT_COMMAND_UPDATE_TYPES]);
    expect(resolveMaxBotUpdateTypes('  ,  ')).toEqual([...MAX_BOT_COMMAND_UPDATE_TYPES]);
  });

  it('reads a comma-separated list and trims items', () => {
    process.env.MAX_BOT_UPDATE_TYPES = ' message_created, message_callback ';
    expect(resolveMaxBotUpdateTypes()).toEqual(['message_created', 'message_callback']);
  });
});