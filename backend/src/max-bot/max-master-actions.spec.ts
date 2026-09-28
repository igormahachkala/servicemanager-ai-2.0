import { parseMasterAction } from './max-master-actions';

const TICKET = '11111111-1111-4111-8111-111111111111';
const TECH = '22222222-2222-4222-8222-222222222222';

describe('parseMasterAction', () => {
  it('parses list, card, assign and wait-keeping comment payloads', () => {
    expect(parseMasterAction('mf:new')).toEqual({ kind: 'filter', filter: 'new' });
    expect(parseMasterAction('ml:work:3')).toEqual({ kind: 'list', filter: 'work', offset: 3 });
    expect(parseMasterAction('mu:0')).toEqual({ kind: 'unassigned', offset: 0 });
    expect(parseMasterAction(`mk:${TICKET}`)).toEqual({ kind: 'card', ticketId: TICKET });
    expect(parseMasterAction(`ma:${TICKET}:u`)).toEqual({ kind: 'assign', ticketId: TICKET, back: 'u' });
    expect(parseMasterAction(`mpk:${TICKET}:${TECH}:k`)).toEqual({
      kind: 'pick',
      ticketId: TICKET,
      technicianId: TECH,
      back: 'k',
    });
    expect(parseMasterAction(`mm:${TICKET}:m`)).toEqual({ kind: 'comment', ticketId: TICKET, mention: true });
  });

  it('parses client select, change and page payloads', () => {
    expect(parseMasterAction('mcc')).toEqual({ kind: 'changeClient' });
    expect(parseMasterAction('mcp:3')).toEqual({ kind: 'clientPage', offset: 3 });
    expect(parseMasterAction(`mcl:${TICKET}`)).toEqual({ kind: 'selectClient', clientId: TICKET });
    expect(parseMasterAction('mcl:short')).toBeNull();
    expect(parseMasterAction('mcl:client_company_01')).toEqual({
      kind: 'selectClient',
      clientId: 'client_company_01',
    });
  });

  it('does not collide with technician ticket payloads', () => {
    expect(parseMasterAction(`tk:${TICKET}`)).toBeNull();
    expect(parseMasterAction('today')).toBeNull();
    expect(parseMasterAction('rounds')).toBeNull();
  });
});
