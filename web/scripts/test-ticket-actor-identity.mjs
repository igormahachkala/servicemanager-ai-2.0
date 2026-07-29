import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(new URL('..', import.meta.url).pathname)

function transpileTs(relativePath) {
  const source = readFileSync(resolve(root, relativePath), 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  }).outputText
}

function dataUrl(js) {
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
}

const resolveAdminProfileUrl = dataUrl(transpileTs('src/lib/resolveAdminProfile.ts'))
const identityJs = transpileTs('src/lib/ticketActorIdentity.ts').replace(
  /import\s+\{\s*getRoleDisplayLabel\s*\}\s+from\s+['"]\.\/resolveAdminProfile['"];?/,
  `import { getRoleDisplayLabel } from '${resolveAdminProfileUrl}';`,
)

const {
  displayCompanyName,
  presentTicketCreator,
} = await import(dataUrl(identityJs))

const ticketCompany = {
  id: 'client-ticket',
  legalName: 'ООО «Клиент из заявки»',
  brandName: 'Клиент из заявки',
  name: 'Ticket Client',
  type: 'CLIENT',
}

const creatorCompany = {
  id: 'client-creator',
  legalName: 'ООО «Клиент создателя»',
  brandName: 'Клиент создателя',
  name: 'Creator Client',
  type: 'CLIENT',
}

assert.equal(
  displayCompanyName({ id: 'c1', legalName: 'ООО «Юрлицо»', brandName: 'Бренд', name: 'Name' }),
  'ООО «Юрлицо»',
)
assert.equal(
  displayCompanyName({ id: 'c2', legalName: '', brandName: 'Бренд', name: 'Name' }),
  'Бренд',
)
assert.equal(
  displayCompanyName({ id: 'c3', legalName: '', brandName: '', name: 'Name' }),
  'Name',
)

assert.deepEqual(
  presentTicketCreator({
    company: ticketCompany,
    createdByUser: {
      id: 'creator-1',
      email: 'creator@example.test',
      firstName: 'Иван',
      lastName: 'Иванов',
      role: 'ADMIN',
      company: creatorCompany,
    },
  }),
  {
    organization: 'ООО «Клиент создателя»',
    name: 'Иванов Иван',
    role: 'Администратор клиента',
  },
)

assert.deepEqual(
  presentTicketCreator({
    company: ticketCompany,
    createdByUser: {
      id: 'creator-2',
      email: 'creator@example.test',
      firstName: 'Петр',
      lastName: 'Петров',
      role: 'CLIENT',
      company: null,
    },
  }),
  {
    organization: 'Организация не указана',
    name: 'Петров Петр',
    role: 'Клиент',
  },
)

assert.deepEqual(
  presentTicketCreator({
    company: ticketCompany,
    requesterName: 'Старый заявитель',
  }),
  {
    organization: 'ООО «Клиент из заявки»',
    name: 'Старый заявитель',
    role: 'Заявитель',
  },
)

console.log('ticketActorIdentity presenter tests passed')
