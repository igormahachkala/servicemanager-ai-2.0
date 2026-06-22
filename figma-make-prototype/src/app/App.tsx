import { useState, useRef, useEffect, useCallback } from 'react'

// ─── Navigation Stack ─────────────────────────────────────────────────────────
type NavTab = 'home' | 'patrols' | 'chats' | 'analytics'
type Screen =
  | { kind: 'main'; navTab: NavTab }
  | { kind: 'workspace'; ticket: Ticket }
  | { kind: 'create' }
  | { kind: 'awaiting' }
  | { kind: 'profile' }
  | { kind: 'company' }
  | { kind: 'settings' }
  | { kind: 'template-constructor' }
  | { kind: 'equipment-detail'; equipment: EquipmentItem }
  | { kind: 'planning' }
  | { kind: 'add-equipment' }

// ─── Types ────────────────────────────────────────────────────────────────────
type WorkspaceTab = 'chat' | 'info' | 'photos' | 'actions'
type ChatSection = 'objects' | 'tickets' | 'archive' | 'checks' | 'company' | 'max' | 'support'
type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'AWAITING_ACCEPTANCE' | 'DONE' | 'CANCELED'
type StatusFilter = 'all' | 'new' | 'assigned' | 'inprogress' | 'awaiting' | 'done' | 'overdue' | 'mine' | 'myaction'
type UserRole = 'TECHNICIAN' | 'CLIENT' | 'ADMIN'
type ReceiptStatus = 'draft' | 'sent' | 'reviewing' | 'confirmed' | 'rejected' | 'paid'
type ContourMode = 'mobile' | 'management'
type PatrolTab = 'active' | 'planned' | 'history' | 'templates' | 'analytics' | 'equipment'
type TemplateItemType = 'checkbox' | 'yesno' | 'photo' | 'multiphoto' | 'comment' | 'number' | 'select' | 'employee' | 'geo' | 'qr'
type Criticality = 'low' | 'medium' | 'high' | 'critical'
type EquipStatus = 'ok' | 'maintenance' | 'broken'

interface TemplateItem {
  id: string; name: string; type: TemplateItemType; required: boolean
  photoRequired: boolean; commentRequired: boolean; photoMin: number
  criticality: Criticality; autoTicket: boolean; instruction?: string
  autoTicketCategory?: string; autoTicketPriority?: string
}
interface TemplateSection { id: string; name: string; items: TemplateItem[] }
interface InspectionTemplate {
  id: string; name: string; description: string; templateType: string
  sections: TemplateSection[]; seasonal?: boolean; icon: string
}
interface EquipmentItem {
  id: string; name: string; category: string; manufacturer: string; model: string
  serialNumber: string; inventoryNumber: string; objectName: string; location: string
  installDate: string; warrantyDate: string; responsible: string; qrCode: string
  status: EquipStatus; lastMaintenance: string; nextMaintenance: string; photo?: string
}

interface Ticket {
  id: string; number: number; status: TicketStatus
  category: string; problem: string; requester: string; phone: string
  location: string; address: string; priority: 'NORMAL' | 'URGENT'
  urgencyReason?: string; assignee: string | null; sla: string; created: string
  overdue?: boolean; waitingHours?: number; objectId: string
}
interface ServiceObject {
  id: string; name: string; address: string; icon: string; favorite: boolean; mine: boolean
  counts: { newCount: number; assigned: number; inWork: number; awaiting: number; overdue: number }
  lastActivity: string; techniciansOnline: number; tickets: Ticket[]
}
interface Receipt {
  id: string; ticketNumber: number; object: string; category: string
  amount: number; description: string; technician: string; date: string; status: ReceiptStatus
}
interface Patrol {
  id: string; name: string; objectName: string; objectIcon: string
  date: string; time: string; inspector: string
  total: number; done: number; violations: number
  status: 'pending' | 'in-progress' | 'completed'; type: 'planned' | 'fire' | 'technical'
}
type ChatMsg =
  | { id: string; kind: 'system'; time: string; text: string }
  | { id: string; kind: 'ticket-card'; time: string }
  | { id: string; kind: 'incoming'; time: string; author: string; text: string }
  | { id: string; kind: 'outgoing'; time: string; text: string }
  | { id: string; kind: 'photo'; time: string; url: string; caption: string }
interface ToastMsg { id: number; text: string; type: 'success' | 'error' | 'info' }
interface FilterState { status: StatusFilter; objects: Set<string>; categories: Set<string> }

// ─── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES = ['Электрика', 'Сантехника', 'Кондиционирование', 'Холодильное оборудование', 'Вентиляция', 'Лифты', 'Другое']

const OBJECTS: ServiceObject[] = [
  { id:'o1', name:'Фудзияма Арбат', address:'ул. Арбат, д. 12, Москва', icon:'🍣', favorite:true, mine:true,
    counts:{newCount:3,assigned:2,inWork:5,awaiting:2,overdue:1}, lastActivity:'11:24', techniciansOnline:2,
    tickets:[
      {id:'t1',number:4521,status:'IN_PROGRESS',category:'Кондиционирование',problem:'Не работает кондиционер в зале',requester:'Анна Смирнова',phone:'+7 985 123-45-67',location:'Арбат, зал 1',address:'ул. Арбат, д. 12',priority:'URGENT',urgencyReason:'Риск остановки кухни',assignee:'Дмитрий Ковалёв',sla:'14:00',created:'20.06, 09:14',objectId:'o1'},
      {id:'t2',number:4519,status:'AWAITING_ACCEPTANCE',category:'Сантехника',problem:'Протечка трубы в подсобке',requester:'Анна Смирнова',phone:'+7 985 123-45-67',location:'Арбат, подсобка',address:'ул. Арбат, д. 12',priority:'NORMAL',assignee:'Михаил Петров',sla:'—',created:'19.06, 15:00',waitingHours:52,objectId:'o1'},
      {id:'t3',number:4517,status:'NEW',category:'Электрика',problem:'Не работает освещение в зале 2',requester:'Анна Смирнова',phone:'+7 985 123-45-67',location:'Арбат, зал 2',address:'ул. Арбат, д. 12',priority:'NORMAL',assignee:null,sla:'18:00',created:'20.06, 07:50',objectId:'o1'},
      {id:'t3b',number:4516,status:'ASSIGNED',category:'Холодильное оборудование',problem:'Витрина №3 не держит температуру',requester:'Анна Смирнова',phone:'+7 985 123-45-67',location:'Арбат, витрина 3',address:'ул. Арбат, д. 12',priority:'URGENT',assignee:'Алексей Никитин',sla:'12:00',created:'20.06, 08:00',overdue:true,objectId:'o1'},
    ]},
  { id:'o2', name:'Фудзияма Тверская', address:'ул. Тверская, д. 8, Москва', icon:'🍱', favorite:true, mine:true,
    counts:{newCount:1,assigned:3,inWork:2,awaiting:1,overdue:0}, lastActivity:'10:45', techniciansOnline:1,
    tickets:[
      {id:'t4',number:4518,status:'NEW',category:'Вентиляция',problem:'Не работает вытяжная система',requester:'Игорь Белов',phone:'+7 916 234-56-78',location:'Тверская, кухня',address:'ул. Тверская, д. 8',priority:'URGENT',assignee:null,sla:'13:00',created:'20.06, 09:30',objectId:'o2'},
      {id:'t5',number:4515,status:'AWAITING_ACCEPTANCE',category:'Холодильное оборудование',problem:'Ремонт льдогенератора',requester:'Игорь Белов',phone:'+7 916 234-56-78',location:'Тверская, бар',address:'ул. Тверская, д. 8',priority:'NORMAL',assignee:'Михаил Петров',sla:'—',created:'18.06, 11:00',waitingHours:30,objectId:'o2'},
      {id:'t6',number:4512,status:'DONE',category:'Электрика',problem:'Замена автоматов в щитке',requester:'Игорь Белов',phone:'+7 916 234-56-78',location:'Тверская, щитовая',address:'ул. Тверская, д. 8',priority:'NORMAL',assignee:'Дмитрий Ковалёв',sla:'—',created:'19.06, 08:00',objectId:'o2'},
    ]},
  { id:'o3', name:'Офис Пермь', address:'ул. Ленина, д. 45, Пермь', icon:'🏢', favorite:false, mine:false,
    counts:{newCount:2,assigned:1,inWork:1,awaiting:0,overdue:1}, lastActivity:'09:30', techniciansOnline:0,
    tickets:[
      {id:'t7',number:4510,status:'NEW',category:'Кондиционирование',problem:'Кондиционер в переговорной не охлаждает',requester:'Сергей Новиков',phone:'+7 342 345-67-89',location:'Пермь, переговорная',address:'ул. Ленина, д. 45',priority:'NORMAL',assignee:null,sla:'16:00',created:'20.06, 07:00',objectId:'o3'},
      {id:'t7b',number:4508,status:'CANCELED',category:'Сантехника',problem:'Протечка в санузле — отменена',requester:'Сергей Новиков',phone:'+7 342 345-67-89',location:'Пермь, 2 этаж',address:'ул. Ленина, д. 45',priority:'NORMAL',assignee:null,sla:'—',created:'18.06, 06:30',objectId:'o3'},
    ]},
  { id:'o4', name:'Офис Ижевск', address:'ул. Пушкинская, д. 15, Ижевск', icon:'🏠', favorite:false, mine:false,
    counts:{newCount:0,assigned:1,inWork:2,awaiting:1,overdue:0}, lastActivity:'Вчера', techniciansOnline:0,
    tickets:[
      {id:'t8',number:4505,status:'AWAITING_ACCEPTANCE',category:'Электрика',problem:'Замена силовых розеток',requester:'Наталья Крылова',phone:'+7 341 456-78-90',location:'Ижевск, кабинет 201',address:'ул. Пушкинская, д. 15',priority:'NORMAL',assignee:'Михаил Петров',sla:'—',created:'19.06, 14:00',waitingHours:20,objectId:'o4'},
      {id:'t9',number:4504,status:'DONE',category:'Вентиляция',problem:'Чистка вентиляционных решёток',requester:'Наталья Крылова',phone:'+7 341 456-78-90',location:'Ижевск, офис',address:'ул. Пушкинская, д. 15',priority:'NORMAL',assignee:'Алексей Никитин',sla:'—',created:'19.06, 10:00',objectId:'o4'},
    ]},
]

const ALL_TICKETS = OBJECTS.flatMap(o => o.tickets)

const RECEIPTS: Receipt[] = [
  {id:'r1',ticketNumber:4521,object:'Фудзияма Арбат',category:'Кондиционирование',amount:2840,description:'Фреон R410A, 2 кг',technician:'Дмитрий Ковалёв',date:'20.06',status:'reviewing'},
  {id:'r2',ticketNumber:4512,object:'Фудзияма Тверская',category:'Электрика',amount:1250,description:'Автомат защиты 3P 32A',technician:'Алексей Никитин',date:'19.06',status:'paid'},
  {id:'r3',ticketNumber:4508,object:'Офис Пермь',category:'Сантехника',amount:760,description:'Прокладки резиновые, фитинги',technician:'Михаил Петров',date:'18.06',status:'rejected'},
  {id:'r4',ticketNumber:4515,object:'Фудзияма Тверская',category:'Холодильное оборудование',amount:4200,description:'Компрессор для льдогенератора',technician:'Михаил Петров',date:'17.06',status:'confirmed'},
  {id:'r5',ticketNumber:4517,object:'Фудзияма Арбат',category:'Электрика',amount:580,description:'Лампы LED 40шт',technician:'Дмитрий Ковалёв',date:'20.06',status:'draft'},
]

const PATROLS: Patrol[] = [
  {id:'p1',name:'Плановый обход',objectName:'Фудзияма Арбат',objectIcon:'🍣',date:'20.06',time:'09:00',inspector:'Дмитрий Ковалёв',total:12,done:7,violations:2,status:'in-progress',type:'planned'},
  {id:'p2',name:'Пожарный обход',objectName:'БЦ Кристалл',objectIcon:'🏢',date:'19.06',time:'14:00',inspector:'Михаил Петров',total:8,done:8,violations:0,status:'completed',type:'fire'},
  {id:'p3',name:'Технический осмотр',objectName:'Офис Пермь',objectIcon:'🏢',date:'21.06',time:'11:00',inspector:'Алексей Никитин',total:15,done:0,violations:0,status:'pending',type:'technical'},
  {id:'p4',name:'Плановый обход',objectName:'Фудзияма Тверская',objectIcon:'🍱',date:'18.06',time:'10:00',inspector:'Дмитрий Ковалёв',total:10,done:10,violations:1,status:'completed',type:'planned'},
]

const EQUIPMENT: EquipmentItem[] = [
  {id:'e1',name:'Кондиционер Daikin №12',category:'Кондиционирование',manufacturer:'Daikin',model:'RXS35L2',serialNumber:'DK2024-0012',inventoryNumber:'SMA-EQ-000124',objectName:'Фудзияма Арбат',location:'Кухня, зона 2',installDate:'15.03.2022',warrantyDate:'15.03.2026',responsible:'Дмитрий Ковалёв',qrCode:'SMA-EQ-000124',status:'maintenance',lastMaintenance:'10.05.2025',nextMaintenance:'10.08.2025',photo:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=250&fit=crop&auto=format'},
  {id:'e2',name:'Холодильная витрина №3',category:'Холодильное оборудование',manufacturer:'Liebherr',model:'FFNS-325E',serialNumber:'LH2023-0456',inventoryNumber:'SMA-EQ-000087',objectName:'Фудзияма Арбат',location:'Торговый зал, линия 1',installDate:'20.01.2021',warrantyDate:'20.01.2024',responsible:'Михаил Петров',qrCode:'SMA-EQ-000087',status:'broken',lastMaintenance:'01.06.2025',nextMaintenance:'01.09.2025'},
  {id:'e3',name:'Вытяжная система VEX-2000',category:'Вентиляция',manufacturer:'Systemair',model:'VEX-2000',serialNumber:'SY2022-0789',inventoryNumber:'SMA-EQ-000203',objectName:'Фудзияма Тверская',location:'Кухня',installDate:'05.06.2022',warrantyDate:'05.06.2025',responsible:'Алексей Никитин',qrCode:'SMA-EQ-000203',status:'ok',lastMaintenance:'15.04.2025',nextMaintenance:'15.07.2025'},
  {id:'e4',name:'Лифт пассажирский №2',category:'Лифты',manufacturer:'OTIS',model:'Gen2 Comfort',serialNumber:'OT2020-0034',inventoryNumber:'SMA-EQ-000034',objectName:'БЦ Кристалл',location:'Подъезд Б',installDate:'12.12.2020',warrantyDate:'12.12.2025',responsible:'Алексей Никитин',qrCode:'SMA-EQ-000034',status:'ok',lastMaintenance:'01.06.2025',nextMaintenance:'01.09.2025'},
  {id:'e5',name:'Электрощит ГРЩ-1',category:'Электрика',manufacturer:'ABB',model:'MCC-400A',serialNumber:'AB2021-1234',inventoryNumber:'SMA-EQ-000056',objectName:'Офис Пермь',location:'Щитовая, 1 этаж',installDate:'01.09.2021',warrantyDate:'01.09.2024',responsible:'Дмитрий Ковалёв',qrCode:'SMA-EQ-000056',status:'ok',lastMaintenance:'10.03.2025',nextMaintenance:'10.06.2025'},
]

const TEMPLATES: InspectionTemplate[] = [
  {id:'tpl1',icon:'📋',name:'Ежедневный обход',description:'Стандартный ежедневный осмотр объекта',templateType:'Обход',sections:[
    {id:'s1',name:'Торговый зал',items:[
      {id:'i1',name:'Освещение работает',type:'yesno',required:true,photoRequired:false,commentRequired:false,photoMin:0,criticality:'medium',autoTicket:true,autoTicketCategory:'Электрика',autoTicketPriority:'Средний'},
      {id:'i2',name:'Полы чистые, без повреждений',type:'checkbox',required:true,photoRequired:false,commentRequired:false,photoMin:0,criticality:'low',autoTicket:false},
      {id:'i3',name:'Вывеска исправна',type:'yesno',required:false,photoRequired:false,commentRequired:false,photoMin:0,criticality:'low',autoTicket:false},
    ]},
    {id:'s2',name:'Кухня',items:[
      {id:'i4',name:'Холодильное оборудование работает',type:'yesno',required:true,photoRequired:true,commentRequired:false,photoMin:1,criticality:'high',autoTicket:true,autoTicketCategory:'Холодильное оборудование',autoTicketPriority:'Высокий'},
      {id:'i5',name:'Вентиляция работает',type:'yesno',required:true,photoRequired:false,commentRequired:false,photoMin:0,criticality:'high',autoTicket:true,autoTicketCategory:'Вентиляция',autoTicketPriority:'Средний'},
      {id:'i6',name:'Температура холодильника, °C',type:'number',required:true,photoRequired:false,commentRequired:false,photoMin:0,criticality:'medium',autoTicket:false},
    ]},
    {id:'s3',name:'Пожарная безопасность',items:[
      {id:'i7',name:'Огнетушители на месте',type:'yesno',required:true,photoRequired:true,commentRequired:false,photoMin:1,criticality:'critical',autoTicket:true,autoTicketCategory:'Другое',autoTicketPriority:'Срочный'},
      {id:'i8',name:'Эвакуационные выходы свободны',type:'yesno',required:true,photoRequired:false,commentRequired:false,photoMin:0,criticality:'critical',autoTicket:true,autoTicketCategory:'Другое',autoTicketPriority:'Срочный'},
      {id:'i9',name:'Сигнализация активна',type:'yesno',required:true,photoRequired:false,commentRequired:false,photoMin:0,criticality:'critical',autoTicket:true,autoTicketCategory:'Электрика',autoTicketPriority:'Срочный'},
    ]},
  ]},
  {id:'tpl2',icon:'🔥',name:'Пожарная безопасность',description:'Ежемесячная проверка пожарной безопасности',templateType:'Аудит',sections:[]},
  {id:'tpl3',icon:'❄️',name:'ППР кондиционеров',description:'Планово-предупредительный ремонт кондиционеров',templateType:'ППР',sections:[]},
  {id:'tpl4',icon:'🧊',name:'Проверка холодильного оборудования',description:'Проверка температурного режима и состояния',templateType:'ТО оборудования',sections:[]},
  {id:'tpl5',icon:'🧹',name:'Санитарный аудит',description:'Санитарная проверка объекта',templateType:'Аудит',sections:[]},
  {id:'tpl6',icon:'🤝',name:'Контроль подрядчика',description:'Проверка качества выполненных работ',templateType:'Контроль подрядчика',sections:[]},
  {id:'tpl7',icon:'🌱',name:'Подготовка к весне',description:'Проверка кондиционеров, дренажей, фасада',templateType:'Сезонная подготовка',seasonal:true,sections:[]},
  {id:'tpl8',icon:'☀️',name:'Подготовка к лету',description:'Кондиционирование, холодильное, вентиляция',templateType:'Сезонная подготовка',seasonal:true,sections:[]},
  {id:'tpl9',icon:'🍂',name:'Подготовка к осени',description:'Отопление, кровля, водостоки, освещение',templateType:'Сезонная подготовка',seasonal:true,sections:[]},
  {id:'tpl10',icon:'❄️',name:'Подготовка к зиме',description:'Отопление, тепловые завесы, антиобледенение',templateType:'Сезонная подготовка',seasonal:true,sections:[]},
]

const INIT_MSGS: ChatMsg[] = [
  {id:'m0',kind:'ticket-card',time:'09:14'},
  {id:'m1',kind:'system',time:'09:14',text:'Заявка #4521 создана'},
  {id:'m2',kind:'incoming',time:'09:15',author:'Анна Смирнова',text:'Добрый день! Кондиционер в зале не охлаждает. Очень срочно!'},
  {id:'m3',kind:'system',time:'09:42',text:'Назначен исполнитель: Дмитрий Ковалёв'},
  {id:'m4',kind:'outgoing',time:'10:02',text:'Понял, выезжаю. Буду к 10:30.'},
  {id:'m5',kind:'system',time:'10:05',text:'Статус → В работе'},
  {id:'m6',kind:'incoming',time:'10:08',author:'Анна Смирнова',text:'Хорошо, вас встретит администратор.'},
  {id:'m7',kind:'outgoing',time:'11:15',text:'Осмотрел. Утечка фреона. Нужна заправка системы — около 1.5 часов.'},
  {id:'m8',kind:'photo',time:'11:16',url:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=280&h=180&fit=crop&auto=format',caption:'Фото неисправности'},
  {id:'m9',kind:'incoming',time:'11:20',author:'Анна Смирнова',text:'Понятно, приступайте.'},
]

const PHOTOS_DATA = [
  {id:'p1',thumb:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=180&h=130&fit=crop&auto=format',full:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=700&h=500&fit=crop&auto=format',label:'Неисправность',purpose:'issue' as const},
  {id:'p2',thumb:'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=180&h=130&fit=crop&auto=format',full:'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=700&h=500&fit=crop&auto=format',label:'Компрессор',purpose:'issue' as const},
  {id:'p3',thumb:'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=180&h=130&fit=crop&auto=format',full:'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=700&h=500&fit=crop&auto=format',label:'После ремонта',purpose:'report' as const},
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SL: Record<TicketStatus,string> = {NEW:'Новая',ASSIGNED:'Назначена',IN_PROGRESS:'В работе',AWAITING_ACCEPTANCE:'На приёмке',DONE:'Завершена',CANCELED:'Отменена'}
const SB: Record<TicketStatus,string> = {NEW:'bg-orange-100 text-orange-700',ASSIGNED:'bg-blue-100 text-blue-700',IN_PROGRESS:'bg-violet-100 text-violet-700',AWAITING_ACCEPTANCE:'bg-amber-100 text-amber-700',DONE:'bg-emerald-100 text-emerald-700',CANCELED:'bg-slate-100 text-slate-400'}
const SD: Record<TicketStatus,string> = {NEW:'bg-orange-400',ASSIGNED:'bg-blue-400',IN_PROGRESS:'bg-violet-500',AWAITING_ACCEPTANCE:'bg-amber-400',DONE:'bg-emerald-400',CANCELED:'bg-slate-300'}
const RS: Record<ReceiptStatus,{label:string;cls:string}> = {
  draft:{label:'Черновик',cls:'bg-slate-100 text-slate-500'},
  sent:{label:'Отправлен',cls:'bg-blue-100 text-blue-700'},
  reviewing:{label:'Проверяется',cls:'bg-amber-100 text-amber-700'},
  confirmed:{label:'Подтверждён',cls:'bg-emerald-100 text-emerald-700'},
  rejected:{label:'Отклонён',cls:'bg-red-100 text-red-700'},
  paid:{label:'Оплачен',cls:'bg-violet-100 text-violet-700'},
}
const sLabel = (s: TicketStatus) => SL[s]
const sBadge = (s: TicketStatus) => SB[s]
const sDot   = (s: TicketStatus) => SD[s]
const DEFAULT_FILTERS: FilterState = {status:'all',objects:new Set(),categories:new Set()}

function filterTickets(tickets: Ticket[], sf: StatusFilter, role: UserRole): Ticket[] {
  if (sf==='new') return tickets.filter(t=>t.status==='NEW')
  if (sf==='assigned') return tickets.filter(t=>t.status==='ASSIGNED')
  if (sf==='inprogress') return tickets.filter(t=>t.status==='IN_PROGRESS')
  if (sf==='awaiting') return tickets.filter(t=>t.status==='AWAITING_ACCEPTANCE')
  if (sf==='done') return tickets.filter(t=>t.status==='DONE')
  if (sf==='overdue') return tickets.filter(t=>!!t.overdue)
  if (sf==='mine') return tickets.filter(t=>t.assignee==='Дмитрий Ковалёв')
  if (sf==='myaction') {
    if (role==='CLIENT') return tickets.filter(t=>t.status==='AWAITING_ACCEPTANCE')
    if (role==='ADMIN') return tickets.filter(t=>t.status==='NEW'&&!t.assignee)
    return tickets.filter(t=>t.status==='NEW'||t.status==='IN_PROGRESS')
  }
  return tickets
}

// ─── StatusBar ────────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 py-2 bg-white flex-shrink-0">
      <span className="text-[13px] font-semibold text-slate-900 tracking-tight">9:41</span>
      <div className="flex items-center gap-[5px]">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="#0F172A"><rect x="0" y="6" width="2.5" height="5" rx="0.8"/><rect x="4" y="4" width="2.5" height="7" rx="0.8"/><rect x="8" y="2" width="2.5" height="9" rx="0.8"/><rect x="12" y="0" width="2.5" height="11" rx="0.8" opacity="0.25"/></svg>
        <svg width="15" height="11" viewBox="0 0 16 12" fill="#0F172A"><path d="M8 2.5C5.5 2.5 3.2 3.5 1.5 5.2L0 3.7C2.1 1.4 5 0 8 0s5.9 1.4 8 3.7L14.5 5.2C12.8 3.5 10.5 2.5 8 2.5z" opacity="0.3"/><path d="M8 5.5C6.2 5.5 4.6 6.3 3.4 7.6L1.9 6.1C3.5 4.4 5.6 3.3 8 3.3s4.5 1.1 6.1 2.8l-1.5 1.5C11.4 6.3 9.8 5.5 8 5.5z" opacity="0.6"/><path d="M8 8.5c-1 0-1.9.4-2.5 1.1L4 8.1C5 6.8 6.4 6 8 6s3 .8 4 2.1l-1.5 1.5C9.9 8.9 9 8.5 8 8.5z"/><circle cx="8" cy="11" r="1.3"/></svg>
        <div className="flex items-center gap-[2px]"><div className="w-[22px] h-[10px] rounded-[3px] border-[1.5px] border-slate-800 relative overflow-hidden"><div className="absolute inset-[1px] bg-slate-800 rounded-[1.5px]" style={{width:'78%'}}/></div><div className="w-[1.5px] h-[5px] bg-slate-800 rounded-r-sm"/></div>
      </div>
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastStack({toasts,onRemove}:{toasts:ToastMsg[];onRemove:(id:number)=>void}) {
  useEffect(()=>{toasts.forEach(t=>{setTimeout(()=>onRemove(t.id),3500)})},[toasts,onRemove])
  if (!toasts.length) return null
  return (
    <div className="absolute bottom-[88px] left-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t=><div key={t.id} className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-[13px] font-semibold ${t.type==='success'?'bg-emerald-600 text-white':t.type==='error'?'bg-red-600 text-white':'bg-slate-800 text-white'}`}><span>{t.type==='success'?'✓':t.type==='error'?'✗':'ℹ'}</span>{t.text}</div>)}
    </div>
  )
}

// ─── Back Header ──────────────────────────────────────────────────────────────
function BackHeader({title,subtitle,onBack}:{title:string;subtitle?:string;onBack:()=>void}) {
  return (
    <div className="bg-white px-4 pt-2 pb-3 border-b border-slate-100 flex-shrink-0 flex items-center gap-3">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:scale-95">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div><h1 className="text-[17px] font-bold text-slate-900 leading-tight">{title}</h1>{subtitle&&<p className="text-[11px] text-slate-400">{subtitle}</p>}</div>
    </div>
  )
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────
const STATUS_FILTERS: {id:StatusFilter;label:string;dot?:string}[] = [
  {id:'all',label:'Все'},{id:'new',label:'Новые',dot:'bg-orange-400'},
  {id:'assigned',label:'Назначенные',dot:'bg-blue-400'},{id:'inprogress',label:'В работе',dot:'bg-violet-500'},
  {id:'awaiting',label:'На приёмке',dot:'bg-amber-400'},{id:'done',label:'Завершённые',dot:'bg-emerald-500'},
  {id:'overdue',label:'Просрочено',dot:'bg-red-500'},{id:'mine',label:'Мои'},
  {id:'myaction',label:'⚡ Мои действия'},
]

function FilterPanel({filters,onChange,onClose}:{filters:FilterState;onChange:(f:FilterState)=>void;onClose:()=>void}) {
  const [local,setLocal]=useState<FilterState>({...filters,objects:new Set(filters.objects),categories:new Set(filters.categories)})
  const toggle=(key:'objects'|'categories',v:string)=>setLocal(p=>{const n=new Set(p[key]);n.has(v)?n.delete(v):n.add(v);return{...p,[key]:n}})
  const activeCount=(local.status!=='all'?1:0)+local.objects.size+local.categories.size
  return (
    <div className="absolute inset-0 z-40 flex flex-col" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl overflow-y-auto" style={{maxHeight:'88%'}} onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full"/></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h2 className="text-[16px] font-bold">Фильтры</h2>
          <div className="flex items-center gap-2">
            {activeCount>0&&<button onClick={()=>{setLocal(DEFAULT_FILTERS);onChange(DEFAULT_FILTERS);onClose()}} className="text-[12px] font-semibold text-slate-400 px-3 py-1 rounded-full border border-slate-200">Сбросить</button>}
            <button onClick={()=>{onChange(local);onClose()}} className="text-[13px] font-bold bg-blue-600 text-white px-4 py-1.5 rounded-full">{activeCount>0?`Применить (${activeCount})`:'Применить'}</button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Статус заявок</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(f=><button key={f.id} onClick={()=>setLocal(p=>({...p,status:f.id}))} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${local.status===f.id?(f.id==='overdue'?'bg-red-500 text-white border-red-500':f.id==='myaction'?'bg-violet-600 text-white border-violet-600':'bg-blue-600 text-white border-blue-600'):'bg-white text-slate-600 border-slate-200'}`}>{f.dot&&<span className={`w-1.5 h-1.5 rounded-full ${local.status===f.id?'bg-white':f.dot}`}/>}{f.label}</button>)}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Объекты {local.objects.size>0?`(${local.objects.size})`:'(все)'}</p>
            <div className="flex flex-col gap-1.5">
              {OBJECTS.map(o=>{const sel=local.objects.has(o.id);return(
                <button key={o.id} onClick={()=>toggle('objects',o.id)} className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all text-left ${sel?'bg-blue-50 border-blue-300':'bg-white border-slate-200'}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 ${sel?'bg-blue-600 border-blue-600':'border-slate-300'}`}>{sel&&<svg width="11" height="8" viewBox="0 0 12 9" fill="none"><path d="M1 4l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>}</div>
                  <span className="text-[14px]">{o.icon}</span>
                  <div className="flex-1 min-w-0"><p className={`text-[12px] font-semibold ${sel?'text-blue-700':'text-slate-700'}`}>{o.name}</p><p className="text-[10px] text-slate-400 truncate">{o.address}</p></div>
                </button>
              )})}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Категории {local.categories.size>0?`(${local.categories.size})`:'(все)'}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat=>{const sel=local.categories.has(cat);return<button key={cat} onClick={()=>toggle('categories',cat)} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-slate-200'}`}>{sel&&<svg width="10" height="7" viewBox="0 0 12 9" fill="none"><path d="M1 4l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>}{cat}</button>})}
            </div>
          </div>
        </div>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Object Card ──────────────────────────────────────────────────────────────
function ObjectCard({obj,onOpenTicket,searchQuery=''}:{obj:ServiceObject;onOpenTicket:(t:Ticket)=>void;searchQuery?:string}) {
  const [expanded,setExpanded]=useState(false)
  useEffect(()=>{if(searchQuery)setExpanded(true);else setExpanded(false)},[searchQuery])
  const total=obj.counts.newCount+obj.counts.assigned+obj.counts.inWork+obj.counts.awaiting
  // For acts
  const [actsOpen,setActsOpen]=useState(false)
  const [actsPeriod,setActsPeriod]=useState('30d')
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${obj.counts.overdue>0?'border-red-200':'border-slate-100'}`}>
      <div className="p-4 cursor-pointer select-none" onClick={()=>setExpanded(p=>!p)}>
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-[21px] flex-shrink-0 ${obj.counts.overdue>0?'bg-red-50':'bg-slate-50'}`}>{obj.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <div>
                <div className="flex items-center gap-1.5"><h3 className="text-[14px] font-bold text-slate-900">{obj.name}</h3>{obj.favorite&&<span className="text-[12px]">⭐</span>}{obj.techniciansOnline>0&&<div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/><span className="text-[9px] text-emerald-600 font-bold">{obj.techniciansOnline}</span></div>}</div>
                <p className="text-[11px] text-slate-400 truncate">{obj.address}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-slate-400">{obj.lastActivity}</span>
                {total>0&&<span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><span className="text-[9px] text-white font-bold">{total}</span></span>}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform duration-200 ${expanded?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[{l:'Новые',v:obj.counts.newCount,col:'text-orange-600',bg:'bg-orange-50',on:obj.counts.newCount>0},
                {l:'Назначены',v:obj.counts.assigned,col:'text-blue-600',bg:'bg-blue-50',on:obj.counts.assigned>0},
                {l:'В работе',v:obj.counts.inWork,col:'text-violet-600',bg:'bg-violet-50',on:obj.counts.inWork>0},
                {l:'Приёмка',v:obj.counts.awaiting,col:'text-amber-600',bg:'bg-amber-50',on:obj.counts.awaiting>0},
                {l:'Просроч.',v:obj.counts.overdue,col:'text-red-600',bg:'bg-red-50',on:obj.counts.overdue>0},
              ].map(s=><div key={s.l} className={`rounded-lg py-1.5 text-center ${s.on?s.bg:'bg-slate-50'}`}><p className={`text-[15px] font-bold leading-none mb-0.5 ${s.on?s.col:'text-slate-300'}`}>{s.v}</p><p className="text-[8px] text-slate-400 leading-tight">{s.l}</p></div>)}
            </div>
          </div>
        </div>
      </div>
      {expanded&&(
        <div className="border-t border-slate-50">
          {/* Acts modal */}
          {actsOpen&&(
            <div className="bg-blue-50 border-b border-blue-100 px-4 py-3">
              <div className="flex items-center justify-between mb-2"><p className="text-[12px] font-bold text-blue-800">Акты объекта</p><button onClick={()=>setActsOpen(false)} className="text-[10px] text-blue-500">✕</button></div>
              <div className="flex gap-2 mb-2">
                {([['7d','7 дней'],['30d','30 дней'],['90d','90 дней']] as const).map(([k,l])=><button key={k} onClick={()=>setActsPeriod(k)} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all ${actsPeriod===k?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>{l}</button>)}
              </div>
              <div className="bg-white rounded-xl p-2.5 mb-2 border border-blue-200">
                <p className="text-[10px] text-slate-500">Завершённых работ за период: <strong>3 заявки</strong></p>
                <p className="text-[10px] text-slate-400 mt-0.5">Автоматы в щитке · Вытяжная система · Лифт</p>
              </div>
              <button className="w-full py-2 bg-blue-600 text-white rounded-xl text-[12px] font-bold">📄 Сформировать акт PDF</button>
            </div>
          )}
          {obj.tickets.filter(t=>!['DONE','CANCELED'].includes(t.status)).map((ticket,i,arr)=>(
            <div key={ticket.id} onClick={()=>onOpenTicket(ticket)} className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-slate-50 transition-colors ${i<arr.length-1?'border-b border-slate-50':''}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sDot(ticket.status)}`}/>
              <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-0.5"><span className="text-[11px] font-bold text-slate-500">#{ticket.number}</span><span className="text-[10px] text-slate-400 truncate">{ticket.category}</span></div><p className="text-[12px] font-semibold text-slate-800 truncate">{ticket.problem}</p></div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {ticket.overdue&&<span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">просрочено</span>}
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sBadge(ticket.status)}`}>{sLabel(ticket.status)}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          ))}
          {/* Acts button at bottom */}
          <button onClick={e=>{e.stopPropagation();setActsOpen(p=>!p)}} className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-slate-50 text-[11px] font-bold text-blue-600 active:bg-blue-50 transition-colors">
            <span className="text-[14px]">📄</span>Акты выполненных работ →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab Dropdown (replaces all horizontal-scroll tab bars) ──────────────────
interface TabItem { id: string; label: string; icon?: string; badge?: number }

function TabDropdown({tabs,active,onChange}:{tabs:TabItem[];active:string;onChange:(id:string)=>void}) {
  const [open,setOpen]=useState(false)
  const cur=tabs.find(t=>t.id===active)
  return (
    <div className="bg-white border-b border-slate-100 flex-shrink-0">
      {/* Trigger row */}
      <button onClick={()=>setOpen(p=>!p)}
        className="w-full flex items-center gap-3 px-4 py-3 active:bg-slate-50 transition-colors">
        {cur?.icon&&<span className="text-[18px] flex-shrink-0">{cur.icon}</span>}
        <span className="text-[13px] font-bold text-slate-800 flex-1 text-left">{cur?.label}</span>
        {(cur?.badge??0)>0&&<span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{cur!.badge}</span>}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-slate-400">{open?'Скрыть':'Сменить'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${open?'rotate-180':''}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>
      {/* Expanded list */}
      {open&&(
        <div className="border-t border-slate-100 bg-slate-50">
          {tabs.map((tab,i)=>(
            <button key={tab.id} onClick={()=>{onChange(tab.id);setOpen(false)}}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${tab.id===active?'bg-blue-50':'bg-white active:bg-slate-50'} ${i<tabs.length-1?'border-b border-slate-100':''}`}>
              {tab.icon&&<span className="text-[18px] w-7 text-center flex-shrink-0">{tab.icon}</span>}
              <span className={`text-[13px] font-semibold flex-1 ${tab.id===active?'text-blue-700':'text-slate-700'}`}>{tab.label}</span>
              {(tab.badge??0)>0&&<span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tab.id===active?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-500'}`}>{tab.badge}</span>}
              {tab.id===active&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({onOpenTicket,role,push,addToast}:{onOpenTicket:(t:Ticket)=>void;role:UserRole;push:(s:Screen)=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [filters,setFilters]=useState<FilterState>(DEFAULT_FILTERS)
  const [filterOpen,setFilterOpen]=useState(false)
  const [homeSearch,setHomeSearch]=useState('')
  const homeSearchRef=useRef<HTMLInputElement>(null)

  const hq=homeSearch.trim().toLowerCase()
  const awaitingCount=ALL_TICKETS.filter(t=>t.status==='AWAITING_ACCEPTANCE').length
  const myActionCount=ALL_TICKETS.filter(t=>filterTickets([t],'myaction',role).length>0).length
  const totalNew=OBJECTS.reduce((s,o)=>s+o.counts.newCount,0)
  const totalOverdue=OBJECTS.reduce((s,o)=>s+o.counts.overdue,0)
  const totalInWork=OBJECTS.reduce((s,o)=>s+o.counts.inWork,0)
  const activeCount=(filters.status!=='all'?1:0)+filters.objects.size+filters.categories.size

  const filtered=OBJECTS.filter(o=>{
    if(filters.objects.size>0&&!filters.objects.has(o.id)) return false
    if(filters.categories.size>0&&!o.tickets.some(t=>filters.categories.has(t.category))) return false
    if(filters.status!=='all'&&filterTickets(o.tickets,filters.status,role).length===0) return false
    if(hq) return (
      o.name.toLowerCase().includes(hq)||
      o.address.toLowerCase().includes(hq)||
      o.tickets.some(t=>t.problem.toLowerCase().includes(hq)||t.category.toLowerCase().includes(hq)||String(t.number).includes(hq))
    )
    return true
  })

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {filterOpen&&<FilterPanel filters={filters} onChange={setFilters} onClose={()=>setFilterOpen(false)}/>}
      <div className="bg-white px-4 pt-2 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div><p className="text-[11px] text-slate-400">Управление объектами</p><h1 className="text-[18px] font-bold text-slate-900">Дмитрий Ковалёв</h1></div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"/></button>
            <button onClick={()=>push({kind:'profile'})} className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shadow-sm"><span className="text-white text-[12px] font-bold">ДК</span></button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-2"><span className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[11px] text-emerald-600 font-semibold">Онлайн · {{TECHNICIAN:'Техник',CLIENT:'Клиент',ADMIN:'Администратор'}[role]}</span></div>
        {/* Search bar */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-2xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-300 transition-all">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={homeSearchRef} className="flex-1 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none min-w-0"
            placeholder="Объект, адрес, заявка, категория, №..." value={homeSearch} onChange={e=>setHomeSearch(e.target.value)}/>
          {homeSearch&&<button onClick={()=>setHomeSearch('')} className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-50" style={{scrollbarWidth:'none'}}>
        <div className="px-4 pt-3 pb-2">
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[{l:'Объектов',v:OBJECTS.length,col:'text-blue-700',bg:'bg-blue-50 border-blue-100',f:'all' as StatusFilter},
              {l:'Новых',v:totalNew,col:'text-orange-600',bg:'bg-orange-50 border-orange-100',f:'new' as StatusFilter},
              {l:'Просрочено',v:totalOverdue,col:totalOverdue>0?'text-red-700':'text-slate-300',bg:totalOverdue>0?'bg-red-50 border-red-200':'bg-slate-50 border-slate-100',f:'overdue' as StatusFilter},
              {l:'В работе',v:totalInWork,col:'text-violet-700',bg:'bg-violet-50 border-violet-100',f:'inprogress' as StatusFilter},
            ].map(s=><button key={s.l} onClick={()=>setFilters(p=>({...p,status:s.f}))} className={`rounded-2xl border p-2.5 text-center active:scale-95 transition-transform ${s.bg} ${filters.status===s.f?'ring-2 ring-blue-400 ring-offset-1':''}`}><p className={`text-[18px] font-bold leading-none mb-0.5 ${s.col}`}>{s.v}</p><p className="text-[9px] text-slate-400">{s.l}</p></button>)}
          </div>
          {awaitingCount>0&&(
            <button onClick={()=>push({kind:'awaiting'})} className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-2 active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-[20px]">⏳</span></div>
              <div className="flex-1 text-left"><p className="text-[13px] font-bold text-amber-800">На приёмке</p><p className="text-[11px] text-amber-600">{awaitingCount} заявок ожидают вашего решения</p></div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {myActionCount>0&&(
            <button onClick={()=>setFilters(p=>({...p,status:'myaction'}))} className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-2 active:scale-[0.98] transition-transform border ${filters.status==='myaction'?'bg-violet-600 text-white border-violet-600':'bg-violet-50 border-violet-200'}`}>
              <span className="text-[20px]">⚡</span>
              <div className="flex-1 text-left"><p className={`text-[13px] font-bold ${filters.status==='myaction'?'text-white':'text-violet-800'}`}>Требует моего действия</p><p className={`text-[11px] ${filters.status==='myaction'?'text-violet-200':'text-violet-600'}`}>{myActionCount} заявок</p></div>
              <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${filters.status==='myaction'?'bg-white/20 text-white':'bg-violet-100 text-violet-700'}`}>{myActionCount}</span>
            </button>
          )}
          {/* Planning card */}
          <button onClick={()=>push({kind:'planning'})}
            className="w-full flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-bold text-violet-800">Планирование</p>
              <p className="text-[11px] text-violet-600">3 сотрудника на смене · 5 задач сегодня</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3">
          <p className="text-[12px] font-semibold text-slate-500 flex-1">{filtered.length===OBJECTS.length?`${OBJECTS.length} объектов`:`${filtered.length} из ${OBJECTS.length}`}</p>
          {activeCount>0&&<button onClick={()=>setFilters(DEFAULT_FILTERS)} className="text-[11px] font-semibold text-slate-400 px-2.5 py-1 rounded-full border border-slate-200 bg-white">Сбросить ×</button>}
          <button onClick={()=>setFilterOpen(true)} className={`flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-1.5 rounded-full border active:scale-95 transition-all ${activeCount>0?'bg-blue-50 text-blue-700 border-blue-200':'bg-white text-slate-600 border-slate-200'}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            {activeCount>0?`Фильтры (${activeCount})`:'Фильтры'}
          </button>
        </div>
        {hq&&<div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 mx-0"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span className="text-[11px] font-semibold text-blue-700 flex-1">{filtered.length} {filtered.length===1?'объект':'объектов'} по запросу</span><button onClick={()=>setHomeSearch('')} className="text-[11px] text-blue-500 font-semibold">Сбросить</button></div>}
        <div className="px-4 pb-5 flex flex-col gap-3 pt-2">
          {filtered.map(o=><ObjectCard key={o.id} obj={o} onOpenTicket={onOpenTicket} searchQuery={hq}/>)}
          {filtered.length===0&&<div className="flex flex-col items-center gap-3 py-12"><span className="text-[40px]">{hq?'🔍':'🏢'}</span><p className="text-[13px] text-slate-500">{hq?'Ничего не найдено':'Нет объектов по фильтру'}</p><button onClick={()=>{setFilters(DEFAULT_FILTERS);setHomeSearch('')}} className="text-[12px] font-semibold text-blue-600">Сбросить</button></div>}
          {!hq&&<p className="text-center text-[10px] text-slate-400 mt-1">Нажмите на объект, чтобы раскрыть заявки</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Awaiting Screen ──────────────────────────────────────────────────────────
function AwaitingScreen({onOpenTicket,push,addToast}:{onOpenTicket:(t:Ticket)=>void;push:(s:Screen)=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [rejectModal,setRejectModal]=useState<{ticket:Ticket;comment:string;hasPhoto:boolean;err:string}|null>(null)
  const groups=OBJECTS.map(o=>({obj:o,tickets:o.tickets.filter(t=>t.status==='AWAITING_ACCEPTANCE')})).filter(g=>g.tickets.length>0)
  const total=groups.reduce((s,g)=>s+g.tickets.length,0)
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {rejectModal&&(
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3"><h3 className="text-[15px] font-bold">Не принять работу</h3><button onClick={()=>setRejectModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2"><span>⚠️</span><p className="text-[11px] text-orange-700 font-medium">Комментарий и фото обязательны. Заявка вернётся исполнителю.</p></div>
            {rejectModal.err&&<p className="text-[11px] text-red-600 mb-2 font-semibold">{rejectModal.err}</p>}
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Причина отказа *</label>
            <textarea className="mt-1.5 mb-3 w-full bg-slate-50 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none border border-slate-200 resize-none" rows={3} placeholder="Что не принято и что нужно доделать?" value={rejectModal.comment} onChange={e=>setRejectModal(p=>p?({...p,comment:e.target.value,err:''}):(p))}/>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Фото *</label>
            <div className="mt-1.5 mb-4">{!rejectModal.hasPhoto?<button onClick={()=>setRejectModal(p=>p?({...p,hasPhoto:true}):(p))} className="w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">📷 Добавить фото</button>:<div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2"><span className="text-emerald-600">✓</span><span className="text-[12px] font-semibold text-emerald-700">Фото добавлено</span></div>}</div>
            <button onClick={()=>{if(rejectModal.comment.length<3){setRejectModal(p=>p?({...p,err:'Комментарий обязателен'}):(p));return}if(!rejectModal.hasPhoto){setRejectModal(p=>p?({...p,err:'Фото обязательно'}):(p));return}addToast(`Заявка #${rejectModal.ticket.number} отправлена на доработку`,'info');setRejectModal(null)}} className={`w-full py-3.5 rounded-2xl font-bold text-[14px] ${rejectModal.comment.length>=3&&rejectModal.hasPhoto?'bg-red-600 text-white shadow-lg shadow-red-200':'bg-slate-100 text-slate-400'}`}>Отправить на доработку</button>
          </div>
        </div>
      )}
      <BackHeader title="На приёмке" subtitle={`${total} заявок ожидают решения`} onBack={()=>push({kind:'main',navTab:'home'})}/>
      {total===0?(<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6"><span className="text-[56px]">✅</span><p className="text-[16px] font-bold text-slate-700">Всё принято</p></div>):(
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'none'}}>
          {groups.map(group=>(
            <div key={group.obj.id} className="mb-4">
              <div className="flex items-center gap-2 mb-2"><span className="text-[16px]">{group.obj.icon}</span><p className="text-[13px] font-bold text-slate-700">{group.obj.name}</p><span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{group.tickets.length}</span></div>
              {group.tickets.map(ticket=>(
                <div key={ticket.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-3.5 mb-2">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex-1 min-w-0"><p className="text-[11px] font-bold text-slate-500 mb-0.5">#{ticket.number} · {ticket.category}</p><p className="text-[13px] font-semibold text-slate-800 leading-snug">{ticket.problem}</p>{ticket.waitingHours&&<p className="text-[10px] text-amber-600 mt-0.5">⏳ Ожидает {ticket.waitingHours}ч</p>}</div>
                    <button onClick={()=>onOpenTicket(ticket)} className="ml-2 flex-shrink-0 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Чат</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>addToast(`Заявка #${ticket.number} принята ✓`,'success')} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[12px] font-bold active:scale-95 transition-transform shadow-sm shadow-emerald-200">✓ Принять</button>
                    <button onClick={()=>setRejectModal({ticket,comment:'',hasPhoto:false,err:''})} className="flex-1 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-[12px] font-bold active:scale-95 transition-transform">✗ Отклонить</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Patrols Screen ───────────────────────────────────────────────────────────
// ─── Template Constructor Screen ──────────────────────────────────────────────
function TemplateConstructorScreen({onBack,addToast}:{onBack:()=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [step,setStep]=useState<1|2>(1)
  const [name,setName]=useState('')
  const [desc,setDesc]=useState('')
  const [tType,setTType]=useState('Обход')
  const [sections,setSections]=useState([{id:'s1',name:'Раздел 1',items:[] as {id:string;name:string;type:string;criticality:string;required:boolean;autoTicket:boolean}[]}])
  const types=['Обход','Аудит','ППР','ТО оборудования','Контроль подрядчика','Сезонная подготовка','Пользовательский шаблон']
  const itemTypes=['checkbox','yesno','photo','comment','number','select','geo','qr']
  const itemTypeLabels:Record<string,string>={checkbox:'Чекбокс',yesno:'Да/Нет',photo:'Фото',comment:'Комментарий',number:'Число',select:'Список',geo:'Геолокация',qr:'QR-код'}
  const critLabels:Record<string,string>={low:'Низкая',medium:'Средняя',high:'Высокая',critical:'Критическая'}
  const critColors:Record<string,string>={low:'bg-slate-100 text-slate-500',medium:'bg-amber-100 text-amber-700',high:'bg-orange-100 text-orange-700',critical:'bg-red-100 text-red-700'}
  const addItem=(secId:string)=>setSections(prev=>prev.map(s=>s.id===secId?{...s,items:[...s.items,{id:`i${Date.now()}`,name:'Новый пункт',type:'yesno',criticality:'medium',required:true,autoTicket:false}]}:s))
  const addSection=()=>setSections(prev=>[...prev,{id:`s${Date.now()}`,name:`Раздел ${prev.length+1}`,items:[]}])

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white px-4 pt-2 pb-3 border-b border-slate-100 flex-shrink-0 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:scale-95"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div className="flex-1"><h1 className="text-[17px] font-bold text-slate-900">{step===1?'Новый шаблон':'Структура шаблона'}</h1><p className="text-[11px] text-slate-400">Шаг {step} из 2</p></div>
        {step===2&&<button onClick={()=>{addToast('Шаблон сохранён','success');onBack()}} className="text-[12px] font-bold text-white bg-blue-600 px-4 py-2 rounded-xl">Сохранить</button>}
      </div>
      {/* Progress */}
      <div className="flex-shrink-0 h-1 bg-slate-100"><div className="h-full bg-blue-500 transition-all" style={{width:`${step===1?50:100}%`}}/></div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'none'}}>
        {step===1&&(
          <div className="space-y-4">
            <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Название *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Например: Ежедневный обход" className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400"/></div>
            <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Описание</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="Цель и порядок проверки..." className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400 resize-none"/></div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Тип проверки</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {types.map(t=><button key={t} onClick={()=>setTType(t)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${tType===t?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-slate-200'}`}>{t}</button>)}
              </div>
            </div>
            <button onClick={()=>{if(!name.trim()){addToast('Введите название','error');return}setStep(2)}} className={`w-full py-4 rounded-2xl text-[14px] font-bold transition-all ${name.trim()?'bg-blue-600 text-white shadow-lg shadow-blue-200':'bg-slate-100 text-slate-400'}`}>Далее →</button>
          </div>
        )}

        {step===2&&(
          <div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4">
              <p className="text-[12px] font-bold text-blue-800">{name}</p>
              <p className="text-[10px] text-blue-600">{tType}</p>
            </div>
            {sections.map((sec,si)=>(
              <div key={sec.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-3">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50 bg-slate-50">
                  <span className="text-[14px]">📂</span>
                  <input value={sec.name} onChange={e=>setSections(prev=>prev.map(s=>s.id===sec.id?{...s,name:e.target.value}:s))} className="flex-1 bg-transparent text-[13px] font-bold text-slate-700 outline-none"/>
                </div>
                {sec.items.map((item,ii)=>(
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50">
                    <div className="flex-1 min-w-0">
                      <input value={item.name} onChange={e=>setSections(prev=>prev.map(s=>s.id===sec.id?{...s,items:s.items.map((it,idx)=>idx===ii?{...it,name:e.target.value}:it)}:s))} className="w-full text-[12px] font-semibold text-slate-700 outline-none bg-transparent mb-1.5"/>
                      <div className="flex gap-2 flex-wrap">
                        <select value={item.type} onChange={e=>setSections(prev=>prev.map(s=>s.id===sec.id?{...s,items:s.items.map((it,idx)=>idx===ii?{...it,type:e.target.value}:it)}:s))} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg outline-none border-0">
                          {itemTypes.map(t=><option key={t} value={t}>{itemTypeLabels[t]}</option>)}
                        </select>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${critColors[item.criticality]}`}>{critLabels[item.criticality]}</span>
                        {item.required&&<span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-1 rounded-full">Обязательно</span>}
                        {item.autoTicket&&<span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">→ Заявка</span>}
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={()=>addItem(sec.id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-blue-600 active:bg-slate-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Добавить пункт проверки
                </button>
              </div>
            ))}
            <button onClick={addSection} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[12px] font-bold text-slate-500 active:bg-slate-50 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Добавить раздел
            </button>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-4">
              <p className="text-[11px] font-bold text-slate-500 mb-2">ТИПЫ ПУНКТОВ</p>
              <div className="grid grid-cols-2 gap-1.5">
                {itemTypes.map(t=><div key={t} className="flex items-center gap-2 text-[11px] text-slate-500"><span className="text-[14px]">{{checkbox:'☑️',yesno:'✅',photo:'📷',comment:'💬',number:'🔢',select:'📋',geo:'📍',qr:'🔳'}[t]}</span>{itemTypeLabels[t]}</div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Equipment Detail Screen ───────────────────────────────────────────────────
function EquipmentDetailScreen({equipment,onBack,addToast}:{equipment:EquipmentItem;onBack:()=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [tab,setTab]=useState<'info'|'history'|'maintenance'>('info')
  const statusColor:Record<EquipStatus,string>={ok:'bg-emerald-100 text-emerald-700',maintenance:'bg-amber-100 text-amber-700',broken:'bg-red-100 text-red-700'}
  const statusLabel:Record<EquipStatus,string>={ok:'Исправно',maintenance:'На обслуживании',broken:'Неисправно'}
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white px-4 pt-2 pb-3 border-b border-slate-100 flex-shrink-0 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:scale-95"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div className="flex-1 min-w-0"><p className="text-[14px] font-bold text-slate-900 truncate">{equipment.name}</p><p className="text-[10px] text-slate-400">{equipment.objectName} · {equipment.location}</p></div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusColor[equipment.status]}`}>{statusLabel[equipment.status]}</span>
      </div>
      <div className="flex bg-white border-b border-slate-100 flex-shrink-0">
        {(['info','history','maintenance'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`flex-1 py-2.5 text-[11px] font-bold border-b-2 transition-all ${tab===t?'text-blue-600 border-blue-600':'text-slate-400 border-transparent'}`}>{t==='info'?'Карточка':t==='history'?'История':'ТО / ППР'}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{scrollbarWidth:'none'}}>
        {tab==='info'&&(
          <div>
            {equipment.photo&&<div className="rounded-2xl overflow-hidden mb-4 shadow-sm" style={{height:160}}><img src={equipment.photo} alt={equipment.name} className="w-full h-full object-cover"/></div>}
            {/* QR */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5"><rect x="2" y="2" width="8" height="8"/><rect x="14" y="2" width="8" height="8"/><rect x="2" y="14" width="8" height="8"/><rect x="5" y="5" width="2" height="2" fill="#94A3B8"/><rect x="17" y="5" width="2" height="2" fill="#94A3B8"/><rect x="5" y="17" width="2" height="2" fill="#94A3B8"/><line x1="14" y1="14" x2="14" y2="14"/><line x1="16" y1="14" x2="22" y2="14"/><line x1="14" y1="16" x2="14" y2="22"/><line x1="16" y1="16" x2="16" y2="16"/><line x1="18" y1="16" x2="22" y2="16"/><line x1="18" y1="18" x2="18" y2="22"/><line x1="20" y1="18" x2="22" y2="20"/></svg>
              </div>
              <div><p className="text-[11px] text-slate-400 mb-0.5">QR-код объекта</p><p className="text-[14px] font-bold text-slate-800 font-mono">{equipment.qrCode}</p></div>
            </div>
            {/* Fields */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
              {[
                ['🏷️','Категория',equipment.category],
                ['🏭','Производитель',equipment.manufacturer],
                ['📦','Модель',equipment.model],
                ['🔢','Серийный номер',equipment.serialNumber],
                ['📋','Инвентарный номер',equipment.inventoryNumber],
                ['📍','Объект',equipment.objectName],
                ['🗺️','Локация',equipment.location],
                ['📅','Дата установки',equipment.installDate],
                ['🛡️','Гарантия до',equipment.warrantyDate],
                ['👷','Ответственный',equipment.responsible],
                ['🔧','Последнее ТО',equipment.lastMaintenance],
                ['⏰','Следующее ТО',equipment.nextMaintenance],
              ].map(([e,l,v],i,arr)=>(
                <div key={l} className={`flex items-start gap-3 px-4 py-3 ${i<arr.length-1?'border-b border-slate-50':''}`}>
                  <span className="text-[14px] flex-shrink-0 w-5 text-center">{e}</span>
                  <div><p className="text-[10px] text-slate-400">{l}</p><p className="text-[12px] font-semibold text-slate-800">{v}</p></div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>addToast('Заявка создана по оборудованию','success')} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[12px] font-bold shadow-sm shadow-blue-200">+ Создать заявку</button>
              <button onClick={()=>addToast('QR-код готов к печати','info')} className="flex-1 py-3 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-[12px] font-bold">Печать QR</button>
            </div>
          </div>
        )}
        {tab==='history'&&(
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">История заявок</p>
            {[{n:'#4521',d:'Не работает кондиционер',dt:'20.06.2025',s:'IN_PROGRESS'},{n:'#4398',d:'Замена фильтров',dt:'15.04.2025',s:'DONE'},{n:'#4201',d:'Утечка фреона',dt:'01.02.2025',s:'DONE'}].map((item,i)=>(
              <div key={item.n} className="bg-white rounded-2xl border border-slate-100 p-3.5 mb-2">
                <div className="flex items-center gap-2 mb-1"><span className="text-[12px] font-bold text-slate-700">{item.n}</span><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.s==='DONE'?'bg-emerald-100 text-emerald-700':'bg-violet-100 text-violet-700'}`}>{item.s==='DONE'?'Завершена':'В работе'}</span></div>
                <p className="text-[12px] text-slate-600">{item.d}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.dt}</p>
              </div>
            ))}
          </div>
        )}
        {tab==='maintenance'&&(
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
              <span className="text-[24px]">⏰</span>
              <div><p className="text-[12px] font-bold text-amber-800">Следующее ТО</p><p className="text-[11px] text-amber-600">{equipment.nextMaintenance}</p></div>
            </div>
            {[{t:'Плановое ТО',d:'10.05.2025',by:'Дмитрий Ковалёв',ok:true},{t:'Плановое ТО',d:'10.02.2025',by:'Дмитрий Ковалёв',ok:true},{t:'ППР',d:'10.11.2024',by:'Алексей Никитин',ok:true}].map((item,i)=>(
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3.5 mb-2">
                <div className="flex items-center gap-2 mb-1"><span className="text-[12px] font-bold text-slate-700">{item.t}</span><span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Выполнено</span></div>
                <p className="text-[10px] text-slate-400">{item.d} · {item.by}</p>
              </div>
            ))}
            <button onClick={()=>addToast('ТО запланировано','success')} className="w-full py-3.5 bg-blue-600 text-white rounded-2xl text-[13px] font-bold shadow-lg shadow-blue-200 mt-2">+ Запланировать ТО</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Planning Screen (Employees) ──────────────────────────────────────────────
// ─── Add Task Modal ───────────────────────────────────────────────────────────
interface TaskDraft {
  employee: string; taskType: string; date: string; time: string
  duration: string; object: string; description: string; ticketId: string; priority: 'normal'|'urgent'
}

function AddTaskModal({onClose,onSave,defaultEmployee=''}:{onClose:()=>void;onSave:(t:TaskDraft)=>void;defaultEmployee?:string}) {
  const [draft,setDraft]=useState<TaskDraft>({
    employee:defaultEmployee,taskType:'',date:'2025-06-20',time:'09:00',
    duration:'1h',object:'',description:'',ticketId:'',priority:'normal'
  })
  const set=(k:keyof TaskDraft,v:string)=>setDraft(p=>({...p,[k]:v}))
  const [errors,setErrors]=useState<Record<string,string>>({})
  const taskTypes=[
    {id:'patrol',label:'Обход',icon:'📋',color:'bg-blue-50 border-blue-200 text-blue-700'},
    {id:'ticket',label:'Заявка',icon:'🔧',color:'bg-violet-50 border-violet-200 text-violet-700'},
    {id:'to',label:'ТО оборудования',icon:'⚙️',color:'bg-amber-50 border-amber-200 text-amber-700'},
    {id:'ppr',label:'ППР',icon:'🔩',color:'bg-orange-50 border-orange-200 text-orange-700'},
    {id:'check',label:'Проверка',icon:'✅',color:'bg-emerald-50 border-emerald-200 text-emerald-700'},
    {id:'fire',label:'Пожарный обход',icon:'🔥',color:'bg-red-50 border-red-200 text-red-700'},
    {id:'other',label:'Другое',icon:'📌',color:'bg-slate-50 border-slate-200 text-slate-600'},
  ]
  const validate=()=>{
    const e:Record<string,string>={}
    if(!draft.employee) e.emp='Выберите сотрудника'
    if(!draft.taskType) e.type='Выберите тип задачи'
    if(!draft.date) e.date='Укажите дату'
    if(!draft.time) e.time='Укажите время'
    setErrors(e)
    return !Object.keys(e).length
  }
  const save=()=>{if(validate()){onSave(draft);onClose()}}

  return (
    <div className="absolute inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl shadow-2xl max-h-[92%] overflow-y-auto" style={{scrollbarWidth:'none'}} onClick={e=>e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-slate-200 rounded-full"/></div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-[16px] font-bold text-slate-900">Добавить задачу</h2>
          <button onClick={save} className={`text-[13px] font-bold px-4 py-1.5 rounded-full transition-all ${draft.employee&&draft.taskType?'bg-blue-600 text-white shadow-md shadow-blue-200':'bg-slate-100 text-slate-400'}`}>Сохранить</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Task type — visual chips */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">Тип задачи *</p>
            <div className="grid grid-cols-2 gap-2">
              {taskTypes.map(t=>(
                <button key={t.id} onClick={()=>set('taskType',t.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border-2 transition-all active:scale-[0.97] ${draft.taskType===t.id?t.color+' border-current':' bg-white border-slate-100'}`}>
                  <span className="text-[20px]">{t.icon}</span>
                  <span className={`text-[12px] font-bold ${draft.taskType===t.id?'':'text-slate-600'}`}>{t.label}</span>
                </button>
              ))}
            </div>
            {errors.type&&<p className="text-[10px] text-red-500 mt-1">{errors.type}</p>}
          </div>

          {/* Employee */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Сотрудник *</p>
            <div className="flex flex-col gap-2">
              {['Дмитрий Ковалёв','Михаил Петров','Алексей Никитин'].map(name=>{
                const abbr=name.split(' ').map(n=>n[0]).join('')
                const sel=draft.employee===name
                return (
                  <button key={name} onClick={()=>set('employee',name)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.97] ${sel?'bg-blue-50 border-blue-400':'bg-white border-slate-100'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-[12px] flex-shrink-0 ${sel?'bg-blue-600 text-white':'bg-slate-100 text-slate-600'}`}>{abbr}</div>
                    <div className="flex-1 text-left">
                      <p className={`text-[13px] font-semibold ${sel?'text-blue-700':'text-slate-700'}`}>{name}</p>
                      <p className="text-[10px] text-slate-400">Техник · На смене</p>
                    </div>
                    {sel&&<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                )
              })}
            </div>
            {errors.emp&&<p className="text-[10px] text-red-500 mt-1">{errors.emp}</p>}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Дата *</p>
              <input type="date" value={draft.date} onChange={e=>set('date',e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400"/>
              {errors.date&&<p className="text-[10px] text-red-500 mt-1">{errors.date}</p>}
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Время *</p>
              <input type="time" value={draft.time} onChange={e=>set('time',e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400"/>
              {errors.time&&<p className="text-[10px] text-red-500 mt-1">{errors.time}</p>}
            </div>
          </div>

          {/* Duration */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Длительность</p>
            <div className="flex gap-2 flex-wrap">
              {[['30m','30 мин'],['1h','1 час'],['2h','2 часа'],['4h','4 часа'],['day','Весь день']].map(([k,l])=>(
                <button key={k} onClick={()=>set('duration',k)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${draft.duration===k?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-slate-200'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Object */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Объект</p>
            <select value={draft.object} onChange={e=>set('object',e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400">
              <option value="">Выберите объект...</option>
              {OBJECTS.map(o=><option key={o.id} value={o.name}>{o.icon} {o.name}</option>)}
            </select>
          </div>

          {/* Link to ticket */}
          {draft.taskType==='ticket'&&(
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Привязать к заявке</p>
              <select value={draft.ticketId} onChange={e=>set('ticketId',e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400">
                <option value="">Выберите заявку...</option>
                {ALL_TICKETS.filter(t=>!['DONE','CANCELED'].includes(t.status)).map(t=>(
                  <option key={t.id} value={t.id}>#{t.number} · {t.problem.slice(0,35)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Описание</p>
            <textarea value={draft.description} onChange={e=>set('description',e.target.value)} rows={2}
              placeholder="Дополнительные инструкции..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400 resize-none"/>
          </div>

          {/* Priority */}
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Приоритет</p>
            <div className="flex gap-2">
              <button onClick={()=>set('priority','normal')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${draft.priority==='normal'?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>Обычный</button>
              <button onClick={()=>set('priority','urgent')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${draft.priority==='urgent'?'bg-red-600 text-white border-red-600':'bg-white text-slate-500 border-slate-200'}`}>⚡ Срочный</button>
            </div>
          </div>

          {/* Summary preview */}
          {draft.employee&&draft.taskType&&(
            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <p className="text-[11px] font-bold text-blue-700 mb-1">Предварительный просмотр</p>
              <p className="text-[12px] text-blue-800 font-semibold">
                {taskTypes.find(t=>t.id===draft.taskType)?.icon} {taskTypes.find(t=>t.id===draft.taskType)?.label}
                {draft.object&&` · ${draft.object}`}
              </p>
              <p className="text-[11px] text-blue-600">{draft.employee} · {draft.date} в {draft.time} · {
                {d:'весь день','30m':'30 мин','1h':'1 час','2h':'2 часа','4h':'4 часа',day:'весь день'}[draft.duration]||draft.duration
              }</p>
            </div>
          )}

          <button onClick={save}
            className={`w-full py-4 rounded-2xl text-[15px] font-bold transition-all ${draft.employee&&draft.taskType?'bg-blue-600 text-white shadow-lg shadow-blue-200':'bg-slate-100 text-slate-400'}`}>
            Добавить в расписание
          </button>
        </div>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Planning Screen ───────────────────────────────────────────────────────────
function PlanningScreen({onBack,addToast}:{onBack:()=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  // ↑ addToast passed from App, used in handleSaveTask and autoplan
  const [tab,setTab]=useState<'today'|'calendar'|'staff'|'schedule'|'history'>('today')
  const [showAddTask,setShowAddTask]=useState(false)
  const [addTaskEmployee,setAddTaskEmployee]=useState('')

  const openAddTask=(emp='')=>{setAddTaskEmployee(emp);setShowAddTask(true)}

  const [taskList,setTaskList]=useState([
    {time:'09:00',label:'Обход',obj:'Фудзияма Арбат',icon:'📋',color:'bg-blue-50 border-blue-200',employee:'Дмитрий Ковалёв',done:true},
    {time:'10:30',label:'Заявка #4521',obj:'Кондиционер в зале',icon:'🔧',color:'bg-violet-50 border-violet-200',employee:'Дмитрий Ковалёв',done:true},
    {time:'12:00',label:'ТО оборудования',obj:'Холодильная витрина №3',icon:'⚙️',color:'bg-amber-50 border-amber-200',employee:'Михаил Петров',done:false},
    {time:'14:00',label:'Заявка #4518',obj:'Вытяжная система',icon:'🔧',color:'bg-violet-50 border-violet-200',employee:'Дмитрий Ковалёв',done:false},
    {time:'16:00',label:'Пожарный обход',obj:'БЦ Кристалл',icon:'🔥',color:'bg-red-50 border-red-200',employee:'Алексей Никитин',done:false},
  ])

  const handleSaveTask=(draft:TaskDraft)=>{
    const typeConfig:{[k:string]:{icon:string;color:string}}={
      patrol:{icon:'📋',color:'bg-blue-50 border-blue-200'},
      ticket:{icon:'🔧',color:'bg-violet-50 border-violet-200'},
      to:{icon:'⚙️',color:'bg-amber-50 border-amber-200'},
      ppr:{icon:'🔩',color:'bg-orange-50 border-orange-200'},
      check:{icon:'✅',color:'bg-emerald-50 border-emerald-200'},
      fire:{icon:'🔥',color:'bg-red-50 border-red-200'},
      other:{icon:'📌',color:'bg-slate-50 border-slate-200'},
    }
    const cfg=typeConfig[draft.taskType]||{icon:'📌',color:'bg-slate-50 border-slate-200'}
    setTaskList(prev=>[...prev,{
      time:draft.time,label:draft.taskType==='ticket'&&draft.ticketId?`Заявка #${ALL_TICKETS.find(t=>t.id===draft.ticketId)?.number||'—'}`:['patrol','Обход','to','ТО','ppr','ППР','check','Проверка','fire','Пожарный обход','other','Задача'].filter((_,i)=>i%2===0).reduce((acc,k,i)=>({...acc,[k]:['patrol','Обход','to','ТО оборудования','ppr','ППР','check','Проверка','fire','Пожарный обход','other','Задача'].filter((_,j)=>j%2===0)[i]||draft.taskType}),{} as Record<string,string>)[draft.taskType]||draft.taskType,
      obj:draft.object||draft.description||'Задача',
      icon:cfg.icon,color:cfg.color,employee:draft.employee,done:false
    }])
    addToast(`Задача добавлена: ${draft.employee.split(' ')[0]} · ${draft.time}`,'success')
  }

  const staff=[
    {name:'Дмитрий Ковалёв',role:'Техник',tasks:taskList.filter(t=>t.employee==='Дмитрий Ковалёв').length,hours:6,status:'active'},
    {name:'Михаил Петров',role:'Техник',tasks:taskList.filter(t=>t.employee==='Михаил Петров').length,hours:4,status:'active'},
    {name:'Алексей Никитин',role:'Техник',tasks:taskList.filter(t=>t.employee==='Алексей Никитин').length,hours:2,status:'break'},
  ]
  const doneTasks=taskList.filter(t=>t.done).length
  return (
    <div className="flex-1 overflow-hidden flex flex-col relative">
      {showAddTask&&<AddTaskModal onClose={()=>setShowAddTask(false)} onSave={handleSaveTask} defaultEmployee={addTaskEmployee}/>}

      {/* Header */}
      <div className="bg-white px-4 pt-2 pb-2 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:scale-95">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h1 className="text-[17px] font-bold text-slate-900 flex-1">Планирование</h1>
          <button onClick={()=>openAddTask()} className="flex items-center gap-1.5 bg-blue-600 text-white text-[12px] font-bold px-3.5 py-2 rounded-xl shadow-md shadow-blue-200 active:scale-95 transition-transform">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Задача
          </button>
        </div>
      </div>
      <TabDropdown
        active={tab}
        onChange={v=>setTab(v as typeof tab)}
        tabs={[
          {id:'today',label:'Сегодня',icon:'📅'},
          {id:'calendar',label:'Календарь',icon:'🗓'},
          {id:'staff',label:'Сотрудники',icon:'👥'},
          {id:'schedule',label:'График',icon:'📊'},
          {id:'history',label:'История',icon:'📋'},
        ]}
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{scrollbarWidth:'none'}}>
        {/* Today */}
        {tab==='today'&&(
          <div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[{l:'Задач',v:String(taskList.length),col:'text-blue-700',bg:'bg-blue-50'},
                {l:'Выполнено',v:String(doneTasks),col:'text-emerald-700',bg:'bg-emerald-50'},
                {l:'Осталось',v:String(taskList.length-doneTasks),col:'text-orange-600',bg:'bg-orange-50'}
              ].map(s=><div key={s.l} className={`rounded-2xl p-3 text-center ${s.bg}`}><p className={`text-[22px] font-bold ${s.col}`}>{s.v}</p><p className="text-[9px] text-slate-400">{s.l}</p></div>)}
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">План дня — 20 июня</p>
              <button onClick={()=>openAddTask()} className="text-[11px] font-bold text-blue-600">+ Добавить</button>
            </div>
            {[...taskList].sort((a,b)=>a.time.localeCompare(b.time)).map((task,i)=>(
              <div key={i} className={`flex items-start gap-3 bg-white rounded-2xl border p-3.5 mb-2 ${task.color}`}>
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-[11px] font-bold text-slate-500">{task.time}</p>
                  <span className="text-[18px]">{task.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800">{task.label}</p>
                  <p className="text-[11px] text-slate-500 truncate">{task.obj}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{task.employee.split(' ')[0]}</p>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${task.done?'bg-emerald-500':'bg-slate-200'}`}>
                  {task.done&&<svg width="10" height="7" viewBox="0 0 12 9" fill="none"><path d="M1 4l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>}
                </div>
              </div>
            ))}
            <button onClick={()=>addToast('Автопланирование выполнено','success')} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[12px] font-bold text-blue-600 mt-1 active:bg-slate-50">
              ⚡ Сформировать день автоматически
            </button>
          </div>
        )}

        {/* Calendar */}
        {tab==='calendar'&&(
          <div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-bold text-slate-700">Июнь 2025</p>
                <button onClick={()=>openAddTask()} className="text-[11px] font-bold text-blue-600">+ Задача</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=><p key={d} className="text-[9px] font-bold text-slate-400 mb-1">{d}</p>)}
                {[...Array(30)].map((_,i)=>{
                  const d=i+1
                  const active=d===20
                  const hasTasks=[3,7,10,14,17,20,21,24,27].includes(d)
                  return(
                    <button key={d} onClick={()=>openAddTask()} className={`w-full aspect-square rounded-lg text-[11px] font-semibold flex items-center justify-center relative active:scale-90 transition-transform ${active?'bg-blue-600 text-white':'text-slate-700'}`}>
                      {d}
                      {hasTasks&&!active&&<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400"/>}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">20 июня — {taskList.length} задач</p>
            {taskList.slice(0,3).map((task,i)=>(
              <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 mb-2 flex items-center gap-3">
                <span className="text-[16px]">{task.icon}</span>
                <div className="flex-1"><p className="text-[12px] font-semibold text-slate-700">{task.label}</p><p className="text-[10px] text-slate-400">{task.time} · {task.obj}</p></div>
                <span className="text-[10px] text-slate-400">{task.employee.split(' ')[0]}</span>
              </div>
            ))}
            {taskList.length>3&&<p className="text-center text-[11px] text-slate-400 mt-1">ещё {taskList.length-3} задач</p>}
          </div>
        )}

        {/* Staff */}
        {tab==='staff'&&(
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Сегодня на смене</p>
              <button onClick={()=>openAddTask()} className="text-[11px] font-bold text-blue-600">+ Задача</button>
            </div>
            {staff.map(s=>(
              <div key={s.name} className="bg-white rounded-2xl border border-slate-100 p-4 mb-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[12px] font-bold">{s.name.split(' ').map((n:string)=>n[0]).join('')}</span>
                  </div>
                  <div className="flex-1"><p className="text-[13px] font-bold text-slate-800">{s.name}</p><p className="text-[11px] text-slate-400">{s.role}</p></div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${s.status==='active'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{s.status==='active'?'На смене':'Перерыв'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center"><p className="text-[15px] font-bold text-slate-800">{s.tasks}</p><p className="text-[9px] text-slate-400">задач</p></div>
                  <div className="bg-slate-50 rounded-xl p-2.5 text-center"><p className="text-[15px] font-bold text-slate-800">{s.hours}ч</p><p className="text-[9px] text-slate-400">загрузка</p></div>
                </div>
                {/* Tasks for this employee */}
                {taskList.filter(t=>t.employee===s.name).length>0&&(
                  <div className="border-t border-slate-50 pt-2.5">
                    {taskList.filter(t=>t.employee===s.name).map((task,i)=>(
                      <div key={i} className="flex items-center gap-2 py-1.5">
                        <span className="text-[14px]">{task.icon}</span>
                        <div className="flex-1 min-w-0"><p className="text-[11px] font-semibold text-slate-700 truncate">{task.label}</p></div>
                        <span className="text-[10px] text-slate-400">{task.time}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={()=>openAddTask(s.name)} className="mt-2 w-full py-2 border border-dashed border-blue-200 rounded-xl text-[11px] font-bold text-blue-600 active:bg-blue-50 transition-colors">
                  + Назначить задачу
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Schedule grid */}
        {tab==='schedule'&&(
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">График июнь 2025</p>
              <button onClick={()=>openAddTask()} className="text-[11px] font-bold text-blue-600">+ Задача</button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-3">
              <div className="grid grid-cols-8 bg-slate-50 border-b border-slate-100">
                <div className="px-2 py-2.5 text-[9px] font-bold text-slate-400">Сотрудник</div>
                {['15','16','17','18','19','20','21'].map(d=>(
                  <button key={d} onClick={()=>openAddTask()} className={`py-2.5 text-center active:bg-blue-100 transition-colors ${d==='20'?'bg-blue-50 text-blue-700 font-bold':'text-slate-400'}`}>
                    <p className="text-[9px] font-bold">{d}</p>
                    <p className="text-[7px] text-slate-300">{['Пт','Сб','Вс','Пн','Вт','Ср','Чт'][parseInt(d)-15]}</p>
                  </button>
                ))}
              </div>
              {staff.map(s=>(
                <div key={s.name} className="grid grid-cols-8 border-b border-slate-50 last:border-0">
                  <div className="px-2 py-3 flex items-center">
                    <span className="text-[10px] font-semibold text-slate-700 truncate">{s.name.split(' ')[0]}</span>
                  </div>
                  {['15','16','17','18','19','20','21'].map(d=>{
                    const isOff=['16','21'].includes(d)
                    const isToday=d==='20'
                    const count=isOff?0:(isToday?taskList.filter(t=>t.employee===s.name).length:[3,2,4,1,3,2][parseInt(d)%6])
                    return (
                      <button key={d} onClick={()=>!isOff&&openAddTask(s.name)}
                        className={`py-3 flex flex-col items-center justify-center transition-colors ${isToday?'bg-blue-50':''} ${isOff?'':'active:bg-slate-50'}`}>
                        {isOff
                          ? <span className="text-[9px] text-slate-200 font-bold">—</span>
                          : <>
                              <span className={`text-[12px] font-bold ${count>3?'text-orange-600':count>0?'text-blue-600':'text-slate-300'}`}>{count}</span>
                              {count===0&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                            </>
                        }
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 text-center">Нажмите на ячейку, чтобы добавить задачу сотруднику</p>
            <div className="flex gap-3 mt-2 text-[9px] text-slate-400 justify-center">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"/>≤3 задач</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"/>&gt;3 задач</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200"/>Выходной</span>
            </div>
          </div>
        )}

        {/* История */}
        {tab==='history'&&(
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">История работ — июнь 2025</p>
            {[
              {date:'20.06',name:'Дмитрий Ковалёв',action:'Обход завершён · Фудзияма Арбат',status:'done'},
              {date:'20.06',name:'Михаил Петров',action:'Заявка #4519 выполнена',status:'done'},
              {date:'19.06',name:'Алексей Никитин',action:'ТО оборудования · Пермь',status:'done'},
              {date:'19.06',name:'Дмитрий Ковалёв',action:'Заявка #4516 отклонена клиентом',status:'warn'},
              {date:'18.06',name:'Михаил Петров',action:'Пожарный обход · БЦ Кристалл',status:'done'},
              {date:'18.06',name:'Алексей Никитин',action:'Заявка #4512 просрочена',status:'error'},
            ].map((item,i)=>(
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3.5 mb-2 flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${item.status==='done'?'bg-emerald-500':item.status==='warn'?'bg-amber-500':'bg-red-500'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-slate-700">{item.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{item.action}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0">{item.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add Equipment Screen ─────────────────────────────────────────────────────
function AddEquipmentScreen({onBack,addToast}:{onBack:()=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [name,setName]=useState('')
  const [category,setCategory]=useState('')
  const [manufacturer,setManufacturer]=useState('')
  const [model,setModel]=useState('')
  const [serial,setSerial]=useState('')
  const [inventory,setInventory]=useState('')
  const [objectName,setObjectName]=useState('')
  const [location,setLocation]=useState('')
  const [installDate,setInstallDate]=useState('')
  const [warrantyDate,setWarrantyDate]=useState('')
  const [responsible,setResponsible]=useState('')
  const [hasPhoto,setHasPhoto]=useState(false)
  const [errors,setErrors]=useState<Record<string,string>>({})
  const equipCats=['Кондиционирование','Холодильное оборудование','Вентиляция','Электрика','Лифты','Сантехника','Противопожарное','Другое']
  const validate=()=>{const e:Record<string,string>={};if(!name.trim())e.name='Введите название';if(!category)e.cat='Выберите категорию';if(!objectName)e.obj='Выберите объект';setErrors(e);return!Object.keys(e).length}
  const submit=()=>{if(!validate())return;addToast(`Оборудование «${name}» добавлено`,'success');onBack()}
  const genInv=()=>setInventory(`SMA-EQ-${String(Math.floor(Math.random()*900000+100000))}`)

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white px-4 pt-2 pb-3 border-b border-slate-100 flex-shrink-0 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:scale-95"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
        <div className="flex-1"><h1 className="text-[17px] font-bold text-slate-900">Добавить оборудование</h1><p className="text-[11px] text-slate-400">Новая единица учёта</p></div>
        <button onClick={submit} className={`text-[12px] font-bold px-4 py-2 rounded-xl transition-all ${name.trim()&&category&&objectName?'bg-blue-600 text-white shadow-md shadow-blue-200':'bg-slate-100 text-slate-400'}`}>Сохранить</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'none'}}>
        {/* Photo */}
        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Фото оборудования</label>
          <div className="mt-1.5">
            {!hasPhoto?(
              <div className="flex gap-2">
                <button onClick={()=>setHasPhoto(true)} className="flex-1 flex flex-col items-center justify-center gap-2 py-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 active:bg-slate-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span className="text-[11px] font-semibold">Сделать фото</span>
                </button>
                <button onClick={()=>setHasPhoto(true)} className="flex-1 flex flex-col items-center justify-center gap-2 py-5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 active:bg-slate-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="text-[11px] font-semibold">Из галереи</span>
                </button>
              </div>
            ):(
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[18px]">📷</div>
                <div className="flex-1"><p className="text-[12px] font-semibold text-emerald-700">Фото добавлено</p><p className="text-[10px] text-emerald-500">equipment_photo.jpg</p></div>
                <button onClick={()=>setHasPhoto(false)} className="text-[10px] text-slate-400 font-semibold">✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Main info */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 bg-slate-50 border-b border-slate-100">Основная информация</p>
          {[
            {l:'Название *',v:name,set:setName,ph:'Кондиционер Daikin №12',k:'name',err:errors.name},
            {l:'Производитель',v:manufacturer,set:setManufacturer,ph:'Daikin, Liebherr, OTIS...',k:'',err:''},
            {l:'Модель',v:model,set:setModel,ph:'RXS35L2',k:'',err:''},
          ].map((f,i,arr)=>(
            <div key={f.l} className={`px-4 py-3 ${i<arr.length-1?'border-b border-slate-50':''}`}>
              <label className="text-[11px] font-semibold text-slate-400">{f.l}</label>
              <input value={f.v} onChange={e=>{f.set(e.target.value);if(f.k)setErrors(p=>({...p,[f.k]:''}))} } placeholder={f.ph} className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder-slate-300"/>
              {f.err&&<p className="text-[10px] text-red-500 mt-0.5">{f.err}</p>}
            </div>
          ))}
          <div className="px-4 py-3">
            <label className="text-[11px] font-semibold text-slate-400">Категория *</label>
            <select value={category} onChange={e=>{setCategory(e.target.value);setErrors(p=>({...p,cat:''}))}} className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none">
              <option value="">Выберите...</option>
              {equipCats.map(c=><option key={c}>{c}</option>)}
            </select>
            {errors.cat&&<p className="text-[10px] text-red-500 mt-0.5">{errors.cat}</p>}
          </div>
        </div>

        {/* Identifiers */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 bg-slate-50 border-b border-slate-100">Идентификаторы</p>
          <div className="px-4 py-3 border-b border-slate-50">
            <label className="text-[11px] font-semibold text-slate-400">Серийный номер</label>
            <input value={serial} onChange={e=>setSerial(e.target.value)} placeholder="DK2024-0012" className="mt-0.5 w-full bg-transparent text-[13px] font-mono text-slate-800 outline-none placeholder-slate-300"/>
          </div>
          <div className="px-4 py-3">
            <label className="text-[11px] font-semibold text-slate-400">Инвентарный номер</label>
            <div className="flex items-center gap-2 mt-0.5">
              <input value={inventory} onChange={e=>setInventory(e.target.value)} placeholder="SMA-EQ-000XXX" className="flex-1 bg-transparent text-[13px] font-mono text-slate-800 outline-none placeholder-slate-300"/>
              <button onClick={genInv} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg flex-shrink-0 active:scale-95">Авто</button>
            </div>
            {inventory&&(
              <div className="mt-2 bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2">
                <span className="text-[14px]">🔳</span>
                <p className="text-[11px] font-mono font-bold text-slate-700">{inventory}</p>
                <span className="text-[9px] text-slate-400 ml-auto">QR будет сгенерирован</span>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 bg-slate-50 border-b border-slate-100">Расположение</p>
          <div className="px-4 py-3 border-b border-slate-50">
            <label className="text-[11px] font-semibold text-slate-400">Объект *</label>
            <select value={objectName} onChange={e=>{setObjectName(e.target.value);setErrors(p=>({...p,obj:''}))}} className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none">
              <option value="">Выберите объект...</option>
              {OBJECTS.map(o=><option key={o.id}>{o.icon} {o.name}</option>)}
            </select>
            {errors.obj&&<p className="text-[10px] text-red-500 mt-0.5">{errors.obj}</p>}
          </div>
          <div className="px-4 py-3">
            <label className="text-[11px] font-semibold text-slate-400">Локация внутри объекта</label>
            <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Кухня, зона 2 · Торговый зал" className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder-slate-300"/>
          </div>
        </div>

        {/* Dates & responsible */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 bg-slate-50 border-b border-slate-100">Даты и ответственный</p>
          <div className="px-4 py-3 border-b border-slate-50">
            <label className="text-[11px] font-semibold text-slate-400">Дата установки</label>
            <input type="date" value={installDate} onChange={e=>setInstallDate(e.target.value)} className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none"/>
          </div>
          <div className="px-4 py-3 border-b border-slate-50">
            <label className="text-[11px] font-semibold text-slate-400">Гарантия до</label>
            <input type="date" value={warrantyDate} onChange={e=>setWarrantyDate(e.target.value)} className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none"/>
          </div>
          <div className="px-4 py-3">
            <label className="text-[11px] font-semibold text-slate-400">Ответственный</label>
            <select value={responsible} onChange={e=>setResponsible(e.target.value)} className="mt-0.5 w-full bg-transparent text-[13px] text-slate-800 outline-none">
              <option value="">Выберите сотрудника...</option>
              {['Дмитрий Ковалёв','Михаил Петров','Алексей Никитин'].map(n=><option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <button onClick={submit}
          className={`w-full py-4 rounded-2xl text-[15px] font-bold transition-all ${name.trim()&&category&&objectName?'bg-blue-600 text-white shadow-lg shadow-blue-200':'bg-slate-100 text-slate-400'}`}>
          Добавить оборудование
        </button>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Patrols Screen (main) ────────────────────────────────────────────────────
function PatrolsScreen({addToast,push}:{addToast:(t:string,tp?:ToastMsg['type'])=>void;push:(s:Screen)=>void}) {
  const [tab,setTab]=useState<PatrolTab>('active')
  const [detailPatrol,setDetailPatrol]=useState<Patrol|null>(null)
  const [checkedItems,setCheckedItems]=useState<Set<number>>(new Set())
  const [showCompletionSummary,setShowCompletionSummary]=useState(false)
  const [equip,setEquip]=useState(EQUIPMENT)
  const planned=PATROLS.filter(p=>p.status!=='completed')
  const completed=PATROLS.filter(p=>p.status==='completed')
  const typeIcon:Record<string,string>={planned:'📋',fire:'🔥',technical:'⚙️'}
  const typeLabel:Record<string,string>={planned:'Плановый',fire:'Пожарный',technical:'Технический'}
  const equipStatusColor:Record<EquipStatus,string>={ok:'bg-emerald-100 text-emerald-700',maintenance:'bg-amber-100 text-amber-700',broken:'bg-red-100 text-red-700'}
  const equipStatusLabel:Record<EquipStatus,string>={ok:'Исправно',maintenance:'ТО',broken:'Неисправно'}

  const CHECKLIST=detailPatrol?TEMPLATES[0].sections.flatMap(s=>s.items.map(it=>({name:it.name,section:s.name,criticality:it.criticality,photo:it.photoRequired}))):[{name:'',section:'',criticality:'low',photo:false}]
  const criticalCount=CHECKLIST.filter((c,i)=>!checkedItems.has(i)&&c.criticality==='critical').length

  // Completion summary screen
  if(showCompletionSummary&&detailPatrol) return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-emerald-600 px-4 pt-3 pb-5 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center"><span className="text-[24px]">✅</span></div>
          <div><p className="text-[16px] font-bold text-white">Обход завершён</p><p className="text-[11px] text-emerald-200">{detailPatrol.name} · {detailPatrol.objectName}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[{l:'Проверено',v:`${checkedItems.size}/${CHECKLIST.length}`,icon:'✓'},{l:'Нарушений',v:String(detailPatrol.violations),icon:'⚠'},{l:'Заявок создано',v:'1',icon:'🎫'},{l:'Критических',v:String(criticalCount),icon:'🔴'}].map(s=>(
            <div key={s.l} className="bg-white/10 rounded-2xl px-3 py-3 text-center">
              <p className="text-[22px] font-bold text-white">{s.v}</p>
              <p className="text-[10px] text-emerald-200">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{scrollbarWidth:'none'}}>
        {detailPatrol.violations>0&&(
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
            <p className="text-[12px] font-bold text-orange-800 mb-2">Зафиксированные нарушения</p>
            <div className="bg-white rounded-xl p-3 border border-orange-100">
              <div className="flex items-center gap-2 mb-1"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700`}>Критическое</span></div>
              <p className="text-[12px] font-semibold text-slate-700">Загрязнение вентиляционных решёток</p>
              <p className="text-[10px] text-slate-400">Зал 1 · Создана заявка #4522</p>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4 shadow-sm">
          <p className="text-[12px] font-bold text-slate-700 mb-3">Итоги по разделам</p>
          {TEMPLATES[0].sections.map(sec=>{
            const secItems=sec.items.length
            const secDone=sec.items.filter((it,i)=>checkedItems.has(CHECKLIST.findIndex(c=>c.name===it.name))).length
            return <div key={sec.id} className="flex items-center gap-3 mb-2.5 last:mb-0"><div className="flex-1"><p className="text-[12px] font-semibold text-slate-700">{sec.name}</p><div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{width:`${secItems>0?(secDone/secItems)*100:0}%`}}/></div></div><span className="text-[11px] font-bold text-slate-600 flex-shrink-0">{secDone}/{secItems}</span></div>
          })}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={()=>addToast('PDF отчёт формируется...','info')} className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl text-[13px] font-bold shadow-lg shadow-blue-200">
            <span>📄</span>Сформировать PDF отчёт
          </button>
          <button onClick={()=>addToast('Отчёт отправлен руководителю','success')} className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[13px] font-bold shadow-sm">
            <span>📤</span>Отправить отчёт
          </button>
          <button onClick={()=>addToast('Переход к созданным заявкам','info')} className="w-full flex items-center justify-center gap-2 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[13px] font-bold shadow-sm">
            <span>🎫</span>Открыть созданные заявки
          </button>
          <button onClick={()=>{setShowCompletionSummary(false);setDetailPatrol(null);setCheckedItems(new Set())}} className="w-full py-3 text-slate-400 text-[12px] font-semibold">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )

  if(detailPatrol) return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white px-4 pt-2 pb-2 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={()=>{setDetailPatrol(null);setCheckedItems(new Set())}} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:scale-95"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <div className="flex-1 min-w-0"><p className="text-[14px] font-bold text-slate-900">{detailPatrol.name}</p><p className="text-[10px] text-slate-400">{detailPatrol.objectName} · {detailPatrol.date}</p></div>
          <span className="text-[11px] font-bold text-blue-600">{checkedItems.size}/{CHECKLIST.length}</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 transition-all rounded-full" style={{width:`${(checkedItems.size/CHECKLIST.length)*100}%`}}/></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{scrollbarWidth:'none'}}>
        {TEMPLATES[0].sections.map(sec=>(
          <div key={sec.id} className="mb-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">📂 {sec.name}</p>
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
              {sec.items.map((item,i)=>{
                const idx=CHECKLIST.findIndex(c=>c.name===item.name)
                const checked=checkedItems.has(idx)
                const critColor={low:'border-l-slate-200',medium:'border-l-amber-300',high:'border-l-orange-400',critical:'border-l-red-500'}[item.criticality]
                return (
                  <div key={item.id} onClick={()=>{const n=new Set(checkedItems);n.has(idx)?n.delete(idx):n.add(idx);setCheckedItems(n)}} className={`flex items-start gap-3 px-4 py-3 border-l-4 cursor-pointer active:bg-slate-50 ${critColor} ${i<sec.items.length-1?'border-b border-slate-50':''}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${checked?'bg-emerald-500 border-emerald-500':'border-slate-300'}`}>{checked&&<svg width="10" height="7" viewBox="0 0 12 9" fill="none"><path d="M1 4l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] leading-snug ${checked?'text-slate-400 line-through':'text-slate-700 font-medium'}`}>{item.name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[9px] text-slate-400">{item.type==='yesno'?'Да/Нет':item.type==='photo'?'Фото':'Чекбокс'}</span>
                        {item.photoRequired&&!checked&&<span className="text-[9px] text-orange-500 font-semibold">📷 Фото обязательно</span>}
                        {item.autoTicket&&!checked&&<span className="text-[9px] text-blue-500 font-semibold">→ Заявка</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3"><p className="text-[13px] font-bold text-orange-800">Нарушения ({detailPatrol.violations})</p><button onClick={()=>addToast('Нарушение добавлено','info')} className="text-[11px] font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full">+ Добавить</button></div>
          {detailPatrol.violations>0?(<div className="bg-white rounded-xl p-3 border border-orange-100"><p className="text-[12px] font-semibold text-slate-700 mb-1">Загрязнение вентиляционных решёток</p><p className="text-[10px] text-slate-400 mb-2">Зал 1 · Фото прикреплено</p><button onClick={()=>addToast('Заявка создана из нарушения','success')} className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">Создать заявку</button></div>):<p className="text-[12px] text-orange-600">Нарушений не зафиксировано</p>}
        </div>
        <div className="flex gap-2 mb-4">
          <button onClick={()=>setShowCompletionSummary(true)} className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl text-[13px] font-bold shadow-lg shadow-blue-200">Завершить обход</button>
          <button onClick={()=>addToast('PDF отчёт сформирован','info')} className="px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-600">PDF</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 pt-2 pb-2 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2"><h1 className="text-[20px] font-bold text-slate-900">Обходы</h1>
          {(tab==='active'||tab==='planned')&&<button onClick={()=>addToast('Создание обхода','info')} className="text-[12px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">+ Создать</button>}
          {tab==='templates'&&<button onClick={()=>push({kind:'template-constructor'})} className="text-[12px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl">+ Шаблон</button>}
        </div>
      </div>
      <TabDropdown
        active={tab}
        onChange={v=>setTab(v as PatrolTab)}
        tabs={[
          {id:'active',label:'Активные',icon:'▶️'},
          {id:'planned',label:'Запланированные',icon:'📅'},
          {id:'history',label:'История',icon:'📋'},
          {id:'templates',label:'Шаблоны',icon:'📝'},
          {id:'analytics',label:'Аналитика',icon:'📊'},
          {id:'equipment',label:'Оборудование',icon:'⚙️'},
        ]}
      />

      <div className="flex-1 overflow-y-auto px-4 py-3" style={{scrollbarWidth:'none'}}>
        {/* Active + Planned — patrol cards */}
        {(tab==='active'||tab==='planned')&&(tab==='active'?PATROLS.filter(p=>p.status==='in-progress'):PATROLS.filter(p=>p.status==='pending')).map(patrol=>(
          <div key={patrol.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-3">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] flex-shrink-0 ${patrol.status==='in-progress'?'bg-blue-50':'bg-slate-50'}`}>{typeIcon[patrol.type]}</div>
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><p className="text-[13px] font-bold text-slate-800">{patrol.name}</p><span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{typeLabel[patrol.type]}</span></div><p className="text-[11px] text-slate-500">{patrol.objectIcon} {patrol.objectName}</p><p className="text-[10px] text-slate-400">{patrol.date} в {patrol.time} · {patrol.inspector}</p></div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${patrol.status==='in-progress'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-500'}`}>{patrol.status==='in-progress'?'В процессе':'Запланирован'}</span>
            </div>
            <div className="flex items-center gap-3 mb-3"><div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width:`${patrol.total>0?(patrol.done/patrol.total)*100:0}%`}}/></div><span className="text-[11px] font-semibold text-slate-600 flex-shrink-0">{patrol.done}/{patrol.total}</span></div>
            <button onClick={()=>setDetailPatrol(patrol)} className={`w-full py-2.5 rounded-xl text-[12px] font-bold ${patrol.status==='in-progress'?'bg-blue-600 text-white shadow-sm shadow-blue-200':'bg-blue-50 text-blue-700 border border-blue-200'}`}>{patrol.status==='in-progress'?'Продолжить':'Начать обход'}</button>
          </div>
        ))}
        {tab==='active'&&PATROLS.filter(p=>p.status==='in-progress').length===0&&<div className="flex flex-col items-center gap-3 py-12"><span className="text-[40px]">✅</span><p className="text-[13px] text-slate-400">Нет активных обходов</p></div>}
        {tab==='planned'&&PATROLS.filter(p=>p.status==='pending').length===0&&<div className="flex flex-col items-center gap-3 py-12"><span className="text-[40px]">📅</span><p className="text-[13px] text-slate-400">Нет запланированных обходов</p></div>}

        {/* History */}
        {tab==='history'&&(
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 border-b border-slate-50">Архив обходов</p>
            {PATROLS.filter(p=>p.status==='completed').map((patrol,i,arr)=>(
              <div key={patrol.id} onClick={()=>setDetailPatrol(patrol)} className={`flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-slate-50 ${i<arr.length-1?'border-b border-slate-50':''}`}>
                <span className="text-[18px]">{typeIcon[patrol.type]}</span>
                <div className="flex-1 min-w-0"><p className="text-[12px] font-semibold text-slate-700">{patrol.objectName} · {patrol.name}</p><p className="text-[10px] text-slate-400">{patrol.date} · {patrol.done}/{patrol.total} · {patrol.violations} наруш.</p></div>
                {patrol.violations>0&&<span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">{patrol.violations} наруш.</span>}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}

        {/* Templates */}
        {tab==='templates'&&(
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Стандартные</p>
            {TEMPLATES.filter(t=>!t.seasonal).map((tpl,i)=>(
              <div key={tpl.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-2 flex items-center gap-3">
                <span className="text-[22px] w-10 text-center flex-shrink-0">{tpl.icon}</span>
                <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-slate-800">{tpl.name}</p><p className="text-[10px] text-slate-400">{tpl.templateType} · {tpl.sections.length>0?`${tpl.sections.reduce((s,sec)=>s+sec.items.length,0)} пунктов`:'Пустой'}</p></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-4">Сезонные</p>
            {TEMPLATES.filter(t=>t.seasonal).map(tpl=>(
              <div key={tpl.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-2 flex items-center gap-3">
                <span className="text-[22px] w-10 text-center flex-shrink-0">{tpl.icon}</span>
                <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-slate-800">{tpl.name}</p><p className="text-[10px] text-slate-400">{tpl.description}</p></div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}

        {/* Patrol Analytics */}
        {tab==='analytics'&&(
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[['Обходов всего','12','+3',true],['Выполнено','83%','+5%',true],['Нарушений','8','−2',true],['Заявок из обходов','6','+2',false]].map(([l,v,d,u])=><div key={String(l)} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"><p className="text-[10px] text-slate-400 mb-1">{l}</p><p className="text-[22px] font-bold text-slate-800 leading-none mb-1">{v}</p><p className={`text-[11px] font-semibold ${u?'text-emerald-600':'text-orange-500'}`}>{d}</p></div>)}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-3">
              <p className="text-[13px] font-bold text-slate-700 mb-3">ТОП нарушений</p>
              {[['Загрязнение вентиляции','4 случая','bg-orange-400'],['Освещение не работает','2 случая','bg-red-400'],['Огнетушитель не на месте','1 случай','bg-red-600'],['Холодильник — температура','1 случай','bg-amber-400']].map(([n,v,c])=><div key={String(n)} className="flex items-center gap-3 mb-2.5 last:mb-0"><div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c}`}/><span className="flex-1 text-[11px] text-slate-600">{n}</span><span className="text-[11px] font-bold text-slate-700">{v}</span></div>)}
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[13px] font-bold text-slate-700 mb-3">По объектам</p>
              {OBJECTS.slice(0,3).map(o=><div key={o.id} className="mb-3 last:mb-0"><div className="flex justify-between mb-1"><span className="text-[11px] text-slate-600">{o.icon} {o.name}</span><span className="text-[11px] font-bold text-slate-700">3 обхода</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width:`${[85,70,60][OBJECTS.indexOf(o)]}%`}}/></div></div>)}
            </div>
          </div>
        )}

        {/* Equipment */}
        {tab==='equipment'&&(
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-slate-500">{EQUIPMENT.length} единиц оборудования</p>
              <button onClick={()=>push({kind:'add-equipment'})} className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">+ Добавить</button>
            </div>
            {[{label:'Неисправно',filter:'broken',color:'border-red-200'},{label:'На обслуживании',filter:'maintenance',color:'border-amber-200'},{label:'Исправно',filter:'ok',color:'border-slate-100'}].map(group=>{
              const items=EQUIPMENT.filter(e=>e.status===group.filter as EquipStatus)
              if(!items.length) return null
              return <div key={group.filter}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group.label}</p>
                {items.map(e=>(
                  <div key={e.id} onClick={()=>push({kind:'equipment-detail',equipment:e})} className={`bg-white rounded-2xl border shadow-sm p-4 mb-2 cursor-pointer active:scale-[0.98] transition-transform ${group.color}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] flex-shrink-0 ${equipStatusColor[e.status].split(' ')[0]}`}>⚙️</div>
                      <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-0.5"><p className="text-[13px] font-bold text-slate-800 truncate">{e.name}</p><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${equipStatusColor[e.status]}`}>{equipStatusLabel[e.status]}</span></div><p className="text-[11px] text-slate-500">{e.objectName} · {e.location}</p><p className="text-[10px] text-slate-400">Следующее ТО: {e.nextMaintenance}</p></div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-1"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    <div className="mt-2 flex gap-2"><span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{e.inventoryNumber}</span><span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{e.category}</span></div>
                  </div>
                ))}
              </div>
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add Receipt Modal ────────────────────────────────────────────────────────
function AddReceiptModal({onClose,addToast}:{onClose:()=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [amount,setAmount]=useState('')
  const [comment,setComment]=useState('')
  const [ticketId,setTicketId]=useState('')
  const [hasPhoto,setHasPhoto]=useState(false)
  const [saveAs,setSaveAs]=useState<'draft'|'sent'>('sent')
  return (
    <div className="bg-white w-full rounded-t-3xl shadow-2xl">
      <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full"/></div>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h2 className="text-[16px] font-bold text-slate-900">Добавить чек</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Фото чека</label><div className="mt-1.5">{!hasPhoto?<div className="flex gap-2"><button onClick={()=>setHasPhoto(true)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">📷 Камера</button><button onClick={()=>setHasPhoto(true)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">🖼️ Галерея</button></div>:<div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2"><span className="text-emerald-600">✓</span><span className="text-[12px] font-semibold text-emerald-700">Фото добавлено</span><button onClick={()=>setHasPhoto(false)} className="ml-auto text-[10px] text-slate-400">Удалить</button></div>}</div></div>
        <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Сумма, ₽ *</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[15px] font-bold text-slate-800 outline-none focus:border-blue-400"/></div>
        <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Комментарий</label><textarea value={comment} onChange={e=>setComment(e.target.value)} rows={2} placeholder="Что куплено, для какого объекта..." className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400 resize-none"/></div>
        <div><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Привязать к заявке</label><select value={ticketId} onChange={e=>setTicketId(e.target.value)} className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none"><option value="">Без привязки</option>{ALL_TICKETS.filter(t=>!['DONE','CANCELED'].includes(t.status)).map(t=><option key={t.id} value={t.id}>#{t.number} · {t.problem.slice(0,30)}</option>)}</select></div>
        <div className="flex gap-2">
          <button onClick={()=>setSaveAs('draft')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${saveAs==='draft'?'bg-slate-700 text-white border-slate-700':'bg-white text-slate-500 border-slate-200'}`}>💾 Черновик</button>
          <button onClick={()=>setSaveAs('sent')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${saveAs==='sent'?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>📤 Отправить</button>
        </div>
        <button onClick={()=>{addToast(saveAs==='draft'?'Черновик сохранён':'Чек отправлен на проверку','success');onClose()}} disabled={!amount} className={`w-full py-4 rounded-2xl text-[14px] font-bold transition-all ${amount?'bg-blue-600 text-white shadow-lg shadow-blue-200':'bg-slate-100 text-slate-400'}`}>{saveAs==='draft'?'Сохранить черновик':'Отправить на проверку'}</button>
      </div>
      <div className="h-4"/>
    </div>
  )
}

// ─── Chats Screen ─────────────────────────────────────────────────────────────
function ChatsScreen({onOpenTicket,role}:{onOpenTicket:(t:Ticket)=>void;role:UserRole}) {
  const [activeTab,setActiveTab]=useState<ChatSection>('objects')
  const [expandedObjs,setExpandedObjs]=useState<Set<string>>(new Set())
  const [filters,setFilters]=useState<FilterState>(DEFAULT_FILTERS)
  const [filterOpen,setFilterOpen]=useState(false)
  const [search,setSearch]=useState('')
  const [showAddReceipt,setShowAddReceipt]=useState(false)
  const [archivePeriod,setArchivePeriod]=useState<'7d'|'30d'|'90d'>('30d')
  const [archiveObjFilter,setArchiveObjFilter]=useState<Set<string>>(new Set())
  const [archiveStatusFilter,setArchiveStatusFilter]=useState<'all'|'done'|'canceled'>('all')
  const [toasts,setToasts]=useState<ToastMsg[]>([])
  const toastId=useRef(0)
  const addToast=(text:string,type:ToastMsg['type']='success')=>{const id=++toastId.current;setToasts(p=>[...p,{id,text,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500)}
  const searchRef=useRef<HTMLInputElement>(null)
  const toggleObj=(id:string)=>setExpandedObjs(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  useEffect(()=>{setSearch('')},[activeTab])

  const q=search.trim().toLowerCase()
  const hasFilters=filters.status!=='all'||filters.objects.size>0||filters.categories.size>0
  const showSearch=activeTab==='objects'||activeTab==='tickets'||activeTab==='archive'

  const filteredObjects=q?OBJECTS.filter(o=>o.name.toLowerCase().includes(q)||o.address.toLowerCase().includes(q)||o.tickets.some(t=>t.problem.toLowerCase().includes(q)||String(t.number).includes(q))):OBJECTS
  const filteredTickets=(()=>{
    let t=ALL_TICKETS.filter(tk=>!['DONE','CANCELED'].includes(tk.status))
    if(filters.status!=='all') t=filterTickets(t,filters.status,role)
    if(filters.objects.size>0) t=t.filter(tk=>filters.objects.has(tk.objectId))
    if(q) t=t.filter(tk=>tk.problem.toLowerCase().includes(q)||String(tk.number).includes(q)||tk.category.toLowerCase().includes(q)||tk.location.toLowerCase().includes(q))
    return t
  })()
  const archiveTickets=ALL_TICKETS.filter(t=>{
    if(!['DONE','CANCELED'].includes(t.status)) return false
    if(archiveStatusFilter==='done'&&t.status!=='DONE') return false
    if(archiveStatusFilter==='canceled'&&t.status!=='CANCELED') return false
    if(archiveObjFilter.size>0&&!archiveObjFilter.has(t.objectId)) return false
    if(q&&!t.problem.toLowerCase().includes(q)&&!String(t.number).includes(q)&&!t.category.toLowerCase().includes(q)) return false
    return true
  })

  const tabs:{id:ChatSection;label:string;icon:string;badge?:number}[]=[
    {id:'objects',label:'Объекты',icon:'🏢',badge:OBJECTS.length},
    {id:'tickets',label:'Заявки',icon:'🎫',badge:ALL_TICKETS.filter(t=>['NEW','ASSIGNED','IN_PROGRESS'].includes(t.status)).length},
    {id:'archive',label:'Архив',icon:'📦',badge:ALL_TICKETS.filter(t=>['DONE','CANCELED'].includes(t.status)).length},
    {id:'checks',label:'Чеки',icon:'🧾',badge:RECEIPTS.filter(r=>r.status==='reviewing').length},
    {id:'company',label:'Компания',icon:'👥',badge:3},
    {id:'max',label:'MAX',icon:'🤖'},
    {id:'support',label:'Поддержка',icon:'🆘'},
  ]
  const unread:Record<string,number>={o1:2,o2:0,o3:1,o4:0}

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {filterOpen&&<FilterPanel filters={filters} onChange={setFilters} onClose={()=>setFilterOpen(false)}/>}
      {showAddReceipt&&<div className="absolute inset-0 z-50 bg-black/50 flex items-end"><AddReceiptModal onClose={()=>setShowAddReceipt(false)} addToast={addToast}/></div>}
      <ToastStack toasts={toasts} onRemove={id=>setToasts(p=>p.filter(t=>t.id!==id))}/>

      <div className="bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between px-4 pt-2 pb-2">
          <h1 className="text-[20px] font-bold text-slate-900">Чаты</h1>
          {showSearch&&<button onClick={()=>setFilterOpen(true)} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${hasFilters?'bg-blue-50 text-blue-700 border-blue-200':'bg-white text-slate-500 border-slate-200'}`}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>Фильтры{hasFilters?` (${(filters.status!=='all'?1:0)+filters.objects.size+filters.categories.size})`:''}</button>}
        </div>
        {showSearch&&(
          <div className="flex items-center gap-2 mx-4 mb-2 bg-slate-100 rounded-2xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-300 transition-all">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input ref={searchRef} className="flex-1 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none min-w-0"
              placeholder={activeTab==='objects'?'Объект, заявка, адрес...':activeTab==='archive'?'Поиск в архиве...':'Номер, описание, категория...'}
              value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button onClick={()=>setSearch('')} className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center flex-shrink-0"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
        )}
      </div>
      <TabDropdown
        active={activeTab}
        onChange={v=>setActiveTab(v as ChatSection)}
        tabs={tabs}
      />

      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
        {activeTab==='objects'&&(
          <>
            {q&&<div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span className="text-[11px] font-semibold text-blue-700 flex-1">{filteredObjects.length} найдено</span><button onClick={()=>setSearch('')} className="text-[11px] text-blue-500 font-semibold">Сбросить</button></div>}
            {filteredObjects.length===0&&q?<div className="flex flex-col items-center gap-3 py-14 text-center"><span className="text-[40px]">🔍</span><p className="text-[14px] font-semibold text-slate-600">Ничего не найдено</p><button onClick={()=>setSearch('')} className="text-[12px] text-blue-600 font-semibold">Сбросить</button></div>
              :filteredObjects.map((obj,oi)=>(
              <div key={obj.id} className={`bg-white ${oi<filteredObjects.length-1?'border-b border-slate-50':'border-b border-slate-100'}`}>
                <div onClick={()=>toggleObj(obj.id)} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-slate-50">
                  <div className="relative flex-shrink-0"><div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-[20px]">{obj.icon}</div>{obj.techniciansOnline>0&&<span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"/>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <div className="flex items-center gap-1.5"><span className="text-[13px] font-bold text-slate-800">{obj.name}</span>{obj.counts.overdue>0&&<span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{obj.counts.overdue} просроч.</span>}</div>
                      <div className="flex items-center gap-2 ml-2"><span className="text-[10px] text-slate-400">{obj.lastActivity}</span>{(unread[obj.id]??0)>0&&<span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><span className="text-[9px] text-white font-bold">{unread[obj.id]}</span></span>}</div>
                    </div>
                    <div className="flex gap-2 mb-0.5">{obj.counts.newCount>0&&<span className="text-[10px] text-orange-600 font-semibold">🆕 {obj.counts.newCount}</span>}{obj.counts.inWork>0&&<span className="text-[10px] text-violet-600 font-semibold">⚙️ {obj.counts.inWork}</span>}{obj.counts.awaiting>0&&<span className="text-[10px] text-amber-600 font-semibold">⏳ {obj.counts.awaiting}</span>}</div>
                    <p className="text-[11px] text-slate-400 truncate">{obj.tickets[0]?.problem}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className={`flex-shrink-0 transition-transform ${expandedObjs.has(obj.id)?'rotate-90':''}`}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
                {expandedObjs.has(obj.id)&&(()=>{
                  const vis=q?obj.tickets.filter(t=>t.problem.toLowerCase().includes(q)||String(t.number).includes(q)):obj.tickets.filter(t=>!['DONE','CANCELED'].includes(t.status))
                  return <div className="bg-slate-50 border-t border-slate-100">{vis.length===0?<p className="pl-8 pr-4 py-3 text-[11px] text-slate-400">Нет заявок</p>:vis.map((ticket,ti)=><div key={ticket.id} onClick={()=>onOpenTicket(ticket)} className={`flex items-center gap-3 pl-8 pr-4 py-3 cursor-pointer active:bg-slate-100 ${ti<vis.length-1?'border-b border-slate-100':''}`}><div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${sBadge(ticket.status)}`}><span className={`w-2.5 h-2.5 rounded-full ${sDot(ticket.status)}`}/></div><div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-0.5"><span className="text-[11px] font-bold text-slate-700">#{ticket.number}</span><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sBadge(ticket.status)}`}>{sLabel(ticket.status)}</span>{ticket.overdue&&<span className="text-[9px] font-bold text-red-600">просрочено</span>}</div><p className="text-[12px] text-slate-600 truncate">{ticket.problem}</p><p className="text-[10px] text-slate-400">{ticket.category}</p></div><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg></div>)}</div>
                })()}
              </div>
            ))}
          </>
        )}

        {activeTab==='tickets'&&(
          <div className="bg-white">
            {(q||hasFilters)&&<div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span className="text-[11px] font-semibold text-blue-700 flex-1">{filteredTickets.length} заявок</span><button onClick={()=>{setSearch('');setFilters(DEFAULT_FILTERS)}} className="text-[11px] text-blue-500 font-semibold">Сбросить</button></div>}
            {filteredTickets.length===0?<div className="flex flex-col items-center gap-3 py-14 text-center"><span className="text-[40px]">🔍</span><p className="text-[14px] font-semibold text-slate-600">Не найдено</p><button onClick={()=>{setSearch('');setFilters(DEFAULT_FILTERS)}} className="text-[12px] text-blue-600 font-semibold">Сбросить</button></div>
              :filteredTickets.map((ticket,i)=><div key={ticket.id} onClick={()=>onOpenTicket(ticket)} className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-slate-50 ${i<filteredTickets.length-1?'border-b border-slate-50':''}`}><div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sBadge(ticket.status)}`}><span className={`w-3 h-3 rounded-full ${sDot(ticket.status)}`}/></div><div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-0.5"><span className="text-[12px] font-bold text-slate-800">#{ticket.number}</span><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sBadge(ticket.status)}`}>{sLabel(ticket.status)}</span>{ticket.overdue&&<span className="text-[9px] font-bold text-red-600">просрочено</span>}</div><p className="text-[12px] font-semibold text-slate-700 truncate">{ticket.problem}</p><p className="text-[10px] text-slate-400 truncate">{ticket.location}</p></div><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg></div>)}
          </div>
        )}

        {activeTab==='archive'&&(
          <div>
            {/* Archive filter bar */}
            <div className="bg-white border-b border-slate-100 px-4 pt-3 pb-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                  {(['7d','30d','90d'] as const).map(p=><button key={p} onClick={()=>setArchivePeriod(p)} className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${archivePeriod===p?'bg-white text-blue-600 shadow-sm':'text-slate-400'}`}>{p==='7d'?'7 дн':p==='30d'?'30 дн':'90 дн'}</button>)}
                </div>
                <span className="text-[11px] text-slate-400 flex-1">{archiveTickets.length} записей</span>
                {(q||archiveObjFilter.size>0||archiveStatusFilter!=='all')&&<button onClick={()=>{setSearch('');setArchiveObjFilter(new Set());setArchiveStatusFilter('all')}} className="text-[11px] text-blue-600 font-semibold">Сбросить</button>}
              </div>
              {/* Status sub-filter */}
              <div className="flex gap-1.5">
                {([['all','Все'],['done','Завершённые'],['canceled','Отменённые']] as const).map(([k,l])=><button key={k} onClick={()=>setArchiveStatusFilter(k)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${archiveStatusFilter===k?'bg-slate-700 text-white border-slate-700':'bg-white text-slate-500 border-slate-200'}`}>{l}</button>)}
              </div>
              {/* Object filter — wrap grid (no horizontal scroll) */}
              <div className="grid grid-cols-2 gap-1.5">
                {OBJECTS.map(o=>{
                  const sel=archiveObjFilter.has(o.id)
                  return (
                    <button key={o.id} onClick={()=>{const n=new Set(archiveObjFilter);sel?n.delete(o.id):n.add(o.id);setArchiveObjFilter(n)}}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-left transition-all ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-slate-200'}`}>
                      <span className="text-[14px] flex-shrink-0">{o.icon}</span>
                      <span className={`text-[11px] font-semibold truncate ${sel?'text-white':'text-slate-700'}`}>{o.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            {archiveTickets.length===0?<div className="flex flex-col items-center gap-3 py-14 text-center"><span className="text-[40px]">📦</span><p className="text-[14px] font-semibold text-slate-600">Архив пуст</p></div>
              :archiveTickets.map((ticket,i)=>(
              <div key={ticket.id} onClick={()=>onOpenTicket(ticket)} className={`flex items-center gap-3 px-4 py-3.5 bg-white cursor-pointer active:bg-slate-50 ${i<archiveTickets.length-1?'border-b border-slate-50':''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sBadge(ticket.status)}`}><span className={`w-3 h-3 rounded-full ${sDot(ticket.status)}`}/></div>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-0.5"><span className="text-[12px] font-bold text-slate-600">#{ticket.number}</span><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sBadge(ticket.status)}`}>{sLabel(ticket.status)}</span></div><p className="text-[12px] font-semibold text-slate-600 truncate">{ticket.problem}</p><p className="text-[10px] text-slate-400 truncate">{ticket.location} · {ticket.created}</p></div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}

        {activeTab==='checks'&&(
          <div>
            <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between"><p className="text-[12px] font-semibold text-slate-500">{RECEIPTS.length} чеков</p><button onClick={()=>setShowAddReceipt(true)} className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">+ Добавить чек</button></div>
            {RECEIPTS.map((r,i)=>(
              <div key={r.id} className={`bg-white px-4 py-3.5 ${i<RECEIPTS.length-1?'border-b border-slate-50':''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[16px] flex-shrink-0 ${RS[r.status].cls.split(' ')[0]}`}>🧾</div>
                  <div className="flex-1 min-w-0"><div className="flex items-baseline justify-between mb-0.5"><span className="text-[13px] font-bold text-slate-800">{r.amount.toLocaleString('ru-RU')} ₽</span><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${RS[r.status].cls}`}>{RS[r.status].label}</span></div><p className="text-[12px] text-slate-600 truncate">{r.description}</p><p className="text-[10px] text-slate-400">#{r.ticketNumber} · {r.object} · {r.technician} · {r.date}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab==='company'&&<div className="flex flex-col items-center justify-center gap-4 py-10 px-6 text-center"><div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-[30px]">👥</div><p className="text-[15px] font-bold text-slate-800">Компания</p><p className="text-[12px] text-slate-400 leading-relaxed">Общий командный чат для обсуждения рабочих вопросов</p><button className="text-[13px] font-bold text-blue-600 bg-blue-50 px-5 py-2.5 rounded-xl">Открыть чат →</button></div>}
        {activeTab==='max'&&<div className="flex flex-col items-center justify-center gap-4 py-10 px-6 text-center"><div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-[30px]">🤖</div><p className="text-[15px] font-bold text-slate-800">MAX Ассистент</p><p className="text-[12px] text-slate-400 leading-relaxed">ИИ-ассистент для работы с заявками, аналитикой и объектами</p><button className="text-[13px] font-bold text-white bg-gradient-to-br from-blue-600 to-violet-600 px-5 py-2.5 rounded-xl shadow-md">Начать →</button></div>}
        {activeTab==='support'&&<div className="flex flex-col items-center justify-center gap-4 py-10 px-6 text-center"><div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center text-[30px]">🆘</div><p className="text-[15px] font-bold text-slate-800">Поддержка</p><p className="text-[12px] text-slate-400 leading-relaxed">Техническая поддержка ServiceManager.AI · Пн–Пт 9:00–18:00</p><button className="text-[13px] font-bold text-red-600 bg-red-50 border border-red-200 px-5 py-2.5 rounded-xl">Написать →</button></div>}
        <div className="h-4"/>
      </div>
    </div>
  )
}

// ─── Analytics Screen ─────────────────────────────────────────────────────────
function AnalyticsScreen({push}:{push:(s:Screen)=>void}) {
  const [period,setPeriod]=useState<'7d'|'30d'|'90d'|'365d'|'custom'>('30d')
  const [customFrom,setCustomFrom]=useState('2025-06-01')
  const [customTo,setCustomTo]=useState('2025-06-20')
  const [filterOpen,setFilterOpen]=useState(false)
  const [selObjects,setSelObjects]=useState<Set<string>>(new Set())
  const [selCats,setSelCats]=useState<Set<string>>(new Set())
  const [selStatuses,setSelStatuses]=useState<Set<TicketStatus>>(new Set())
  const [selContractors,setSelContractors]=useState<Set<string>>(new Set())
  const [analyticsView,setAnalyticsView]=useState<'overview'|'top-objects'|'top-cats'|'contractors'|'overdue'|'equipment'>('overview')
  const bars=[38,52,30,65,48,72,55,61,44,78,50,68,42,74]
  const toggle=<T extends string>(s:Set<T>,v:T):Set<T>=>{const n=new Set(s);n.has(v)?n.delete(v):n.add(v);return n}
  const activeParams=selObjects.size+selCats.size+selStatuses.size+selContractors.size
  const periodLabel=period==='7d'?'7 дней':period==='30d'?'30 дней':period==='90d'?'90 дней':period==='365d'?'365 дней':`${customFrom} — ${customTo}`

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {filterOpen&&(
        <div className="absolute inset-0 z-40 flex flex-col" onClick={()=>setFilterOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl overflow-y-auto" style={{maxHeight:'90%'}} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-slate-200 rounded-full"/></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100"><h2 className="text-[16px] font-bold">Параметры</h2><button onClick={()=>setFilterOpen(false)} className="text-[13px] font-bold bg-blue-600 text-white px-4 py-1.5 rounded-full">Готово</button></div>
            <div className="px-5 py-4 space-y-5">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Период</p>
                <div className="flex gap-2 flex-wrap">{([['7d','7 дней'],['30d','30 дней'],['90d','90 дней'],['365d','365 дней'],['custom','Произвольный']] as const).map(([k,l])=><button key={k} onClick={()=>setPeriod(k)} className={`px-3 py-2 rounded-xl text-[12px] font-bold border transition-all ${period===k?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-slate-200'}`}>{l}</button>)}</div>
                {period==='custom'&&<div className="mt-3 flex gap-3"><div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">От</label><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-800 outline-none"/></div><div className="flex-1"><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">До</label><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] text-slate-800 outline-none"/></div></div>}
              </div>
              <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Объекты {selObjects.size>0?`(${selObjects.size})`:'(все)'}</p><div className="flex flex-col gap-1.5">{OBJECTS.map(o=>{const sel=selObjects.has(o.id);return<button key={o.id} onClick={()=>setSelObjects(toggle(selObjects,o.id))} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${sel?'bg-blue-50 border-blue-300':'bg-white border-slate-200'}`}><div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${sel?'bg-blue-600 border-blue-600':'border-slate-300'}`}>{sel&&<svg width="11" height="8" viewBox="0 0 12 9" fill="none"><path d="M1 4l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>}</div><span className="text-[14px]">{o.icon}</span><span className={`text-[12px] font-semibold ${sel?'text-blue-700':'text-slate-700'}`}>{o.name}</span></button>})}</div></div>
              <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Категории {selCats.size>0?`(${selCats.size})`:'(все)'}</p><div className="flex flex-wrap gap-2">{CATEGORIES.map(cat=>{const sel=selCats.has(cat);return<button key={cat} onClick={()=>setSelCats(toggle(selCats,cat))} className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${sel?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-600 border-slate-200'}`}>{sel&&<svg width="10" height="7" viewBox="0 0 12 9" fill="none"><path d="M1 4l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>}{cat}</button>})}</div></div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Статусы {selStatuses.size>0?`(${selStatuses.size})`:'(все)'}</p>
                <div className="flex flex-wrap gap-2">
                  {(['NEW','ASSIGNED','IN_PROGRESS','AWAITING_ACCEPTANCE','DONE','CANCELED'] as TicketStatus[]).map(s=>{const sel=selStatuses.has(s);return<button key={s} onClick={()=>setSelStatuses(toggle(selStatuses,s))} className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${sel?'bg-blue-600 text-white border-blue-600':`${sBadge(s)} border-transparent`}`}>{sLabel(s)}</button>})}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Подрядчики {selContractors.size>0?`(${selContractors.size})`:'(все)'}</p>
                <div className="flex flex-col gap-1.5">
                  {['ООО СервисПлюс','ИП Ковалёв Д.А.','ТехМонтаж','АварийСервис'].map(c=>{const sel=selContractors.has(c);return<button key={c} onClick={()=>setSelContractors(toggle(selContractors,c))} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left ${sel?'bg-blue-50 border-blue-300':'bg-white border-slate-200'}`}><div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${sel?'bg-blue-600 border-blue-600':'border-slate-300'}`}/><span className={`text-[12px] font-semibold ${sel?'text-blue-700':'text-slate-700'}`}>{c}</span></button>})}
                </div>
              </div>
            </div>
            <div className="h-6"/>
          </div>
        </div>
      )}

      <div className="bg-white px-4 pt-2 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div><h1 className="text-[20px] font-bold text-slate-900">Аналитика</h1><p className="text-[11px] text-slate-400">{periodLabel}{activeParams>0?` · ${activeParams} фильтров`:''}</p></div>
          <button onClick={()=>setFilterOpen(true)} className={`flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-2 rounded-full border transition-all ${activeParams>0?'bg-blue-50 text-blue-700 border-blue-200':'bg-white text-slate-600 border-slate-200'}`}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>{activeParams>0?`Параметры (${activeParams})`:'Параметры'}</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {([['7d','7д'],['30d','30д'],['90d','90д'],['365d','365д'],['custom','...']] as const).map(([k,l])=><button key={k} onClick={()=>setPeriod(k)} className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${period===k?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>{l}</button>)}
        </div>
        {period==='custom'&&<div className="mt-2 flex gap-2"><input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-700 outline-none"/><span className="text-slate-400 self-center">—</span><input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] text-slate-700 outline-none"/></div>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6" style={{scrollbarWidth:'none'}}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[['Заявок всего','47','+8%',true],['SLA соблюдён','87%','+2%',true],['Ср. время','3.8ч','−0.4ч',true],['Просрочено','4','−2',true]].map(([l,v,d,u])=><div key={String(l)} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"><p className="text-[10px] text-slate-400 mb-1">{l}</p><p className="text-[22px] font-bold text-slate-800 leading-none mb-1">{v}</p><p className={`text-[11px] font-semibold ${u?'text-emerald-600':'text-red-500'}`}>{d}</p></div>)}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3"><span className="text-[24px]">⏳</span><div><p className="text-[13px] font-bold text-amber-800">На приёмке</p><p className="text-[11px] text-amber-600">{ALL_TICKETS.filter(t=>t.status==='AWAITING_ACCEPTANCE').length} заявок ожидают решения клиента</p></div></div>
        {/* Planning moved to Home screen */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3">
          <p className="text-[13px] font-bold text-slate-700 mb-3">Динамика · {periodLabel}</p>
          <div className="flex items-end gap-1 h-20">{bars.map((h,i)=><div key={i} className="flex-1 h-full flex items-end"><div className={`w-full rounded-t-sm ${i===bars.length-1?'bg-blue-600':'bg-blue-200'}`} style={{height:`${h}%`}}/></div>)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-3">
          <p className="text-[13px] font-bold text-slate-700 mb-3">По объектам</p>
          {OBJECTS.filter(o=>selObjects.size===0||selObjects.has(o.id)).map(o=>{const total=o.counts.newCount+o.counts.assigned+o.counts.inWork+o.counts.awaiting;return<div key={o.id} className="mb-3 last:mb-0"><div className="flex items-center justify-between mb-1"><span className="text-[11px] text-slate-600">{o.icon} {o.name}</span><span className="text-[11px] font-bold text-slate-700">{total}</span></div><div className="h-2 bg-slate-100 rounded-full overflow-hidden flex"><div className="h-full bg-orange-400" style={{width:`${(o.counts.newCount/12)*100}%`}}/><div className="h-full bg-violet-500" style={{width:`${(o.counts.inWork/12)*100}%`}}/><div className="h-full bg-amber-400" style={{width:`${(o.counts.awaiting/12)*100}%`}}/></div></div>})}
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <p className="text-[13px] font-bold text-slate-700 mb-3">По категориям</p>
          {(selCats.size>0?CATEGORIES.filter(c=>selCats.has(c)):CATEGORIES).map((cat,i)=>{const pct=[32,24,18,16,10,6,4][i]||5;return<div key={cat} className="mb-3 last:mb-0"><div className="flex justify-between mb-1"><span className="text-[11px] text-slate-600">{cat}</span><span className="text-[11px] font-bold text-slate-700">{pct}%</span></div><div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width:`${pct}%`}}/></div></div>})}
        </div>

        {/* Ready views */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden mb-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 border-b border-slate-50">Готовые представления</p>
          {/* Dropdown selector instead of horizontal scroll */}
          <div className="px-4 py-2.5 border-b border-slate-50">
            <select value={analyticsView} onChange={e=>setAnalyticsView(e.target.value as typeof analyticsView)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-800 outline-none focus:border-blue-400">
              <option value="overview">📊 Обзор</option>
              <option value="top-objects">🏢 ТОП проблемных объектов</option>
              <option value="top-cats">🔧 ТОП категорий</option>
              <option value="contractors">🤝 Подрядчики</option>
              <option value="overdue">⚠️ Просрочки</option>
              <option value="equipment">⚙️ Оборудование</option>
            </select>
          </div>
          <div className="p-4">
            {analyticsView==='overview'&&<div className="space-y-2">{[{icon:'🏢',label:'Всего объектов',val:'4',sub:'2 с просрочками'},{icon:'🎫',label:'Активных заявок',val:'9',sub:'+2 за неделю'},{icon:'⚡',label:'Срочных заявок',val:'2',sub:'требуют внимания'},{icon:'✅',label:'Закрыто за период',val:'8',sub:'SLA: 87%'}].map(s=><div key={s.label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"><span className="text-[20px] w-8 text-center">{s.icon}</span><div className="flex-1"><p className="text-[12px] font-semibold text-slate-700">{s.label}</p><p className="text-[10px] text-slate-400">{s.sub}</p></div><span className="text-[18px] font-bold text-slate-800">{s.val}</span></div>)}</div>}
            {analyticsView==='top-objects'&&<div className="space-y-2">{OBJECTS.map((o,i)=>{const total=o.counts.newCount+o.counts.assigned+o.counts.inWork+o.counts.awaiting;return<div key={o.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"><span className="text-[14px] font-bold text-slate-400 w-5">{i+1}</span><span className="text-[18px]">{o.icon}</span><div className="flex-1 min-w-0"><p className="text-[12px] font-semibold text-slate-700 truncate">{o.name}</p><p className="text-[10px] text-slate-400">{total} активных{o.counts.overdue>0?` · ${o.counts.overdue} просрочено`:''}</p></div><span className="text-[16px] font-bold text-slate-800">{total}</span></div>})}</div>}
            {analyticsView==='top-cats'&&<div className="space-y-2">{[['Кондиционирование','8','bg-violet-500'],['Электрика','6','bg-blue-500'],['Холодильное','5','bg-cyan-500'],['Сантехника','4','bg-teal-500'],['Вентиляция','3','bg-indigo-400']].map(([c,v,col],i)=><div key={c} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"><span className="text-[13px] font-bold text-slate-400 w-5">{i+1}</span><div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col}`}/><span className="flex-1 text-[12px] font-semibold text-slate-700">{c}</span><span className="text-[14px] font-bold text-slate-800">{v} заявок</span></div>)}</div>}
            {analyticsView==='contractors'&&<div className="space-y-2">{[['ООО СервисПлюс','12 выполнено','96% SLA','⭐ 4.8'],['ИП Ковалёв Д.А.','8 выполнено','88% SLA','⭐ 4.5'],['ТехМонтаж','5 выполнено','72% SLA','⭐ 3.9'],['АварийСервис','3 выполнено','100% SLA','⭐ 4.2']].map(([n,v,sla,r],i)=><div key={n} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"><span className="text-[13px] font-bold text-slate-400 w-5 mt-0.5">{i+1}</span><div className="flex-1"><p className="text-[12px] font-semibold text-slate-700">{n}</p><p className="text-[10px] text-slate-400">{v} · {sla}</p></div><span className="text-[11px] font-bold text-amber-600">{r}</span></div>)}</div>}
            {analyticsView==='overdue'&&<div className="space-y-2">{ALL_TICKETS.filter(t=>t.overdue).map((t)=><div key={t.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"><span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0"/><div className="flex-1 min-w-0"><p className="text-[12px] font-semibold text-slate-700 truncate">#{t.number} · {t.problem}</p><p className="text-[10px] text-slate-400">{t.location} · SLA: {t.sla}</p></div><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sBadge(t.status)}`}>{sLabel(t.status)}</span></div>)}{ALL_TICKETS.filter(t=>t.overdue).length===0&&<p className="text-[13px] text-slate-400 text-center py-4">Просроченных нет ✅</p>}</div>}
            {analyticsView==='equipment'&&<div className="space-y-2">{EQUIPMENT.filter(e=>e.status!=='ok').map(e=><div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-1 ${e.status==='broken'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{e.status==='broken'?'Неиспр.':'ТО'}</span><div className="flex-1 min-w-0"><p className="text-[12px] font-semibold text-slate-700 truncate">{e.name}</p><p className="text-[10px] text-slate-400">{e.objectName} · Следующее ТО: {e.nextMaintenance}</p></div></div>)}{EQUIPMENT.filter(e=>e.status!=='ok').length===0&&<p className="text-[13px] text-slate-400 text-center py-4">Всё оборудование в норме ✅</p>}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create Ticket ────────────────────────────────────────────────────────────
function CreateTicketScreen({onBack,addToast}:{onBack:()=>void;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [objectId,setObjectId]=useState('')
  const [equipmentId,setEquipmentId]=useState('')
  const selectedEquip=EQUIPMENT.find(e=>e.id===equipmentId)
  const [category,setCategory]=useState('')
  const [description,setDescription]=useState('')
  const [hasPhoto,setHasPhoto]=useState(false)
  const [isUrgent,setIsUrgent]=useState(false)
  const [urgencyReason,setUrgencyReason]=useState('')
  const [urgencyModal,setUrgencyModal]=useState(false)
  const [errors,setErrors]=useState<Record<string,string>>({})
  const validate=()=>{const e:Record<string,string>={};if(!objectId)e.object='Выберите объект';if(!category)e.category='Выберите категорию';if(description.trim().length<5)e.description='Опишите проблему (мин. 5 символов)';if(isUrgent&&!urgencyReason.trim())e.urgency='Укажите причину срочности';setErrors(e);return!Object.keys(e).length}
  const submit=()=>{if(!validate())return;addToast('Заявка создана','success');onBack()}
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <BackHeader title="Новая заявка" onBack={onBack}/>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'none'}}>
        <div className="mb-4"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Объект *</label><select value={objectId} onChange={e=>{setObjectId(e.target.value);setErrors(p=>({...p,object:''}))}} className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400"><option value="">Выберите объект...</option>{OBJECTS.map(o=><option key={o.id} value={o.id}>{o.icon} {o.name}</option>)}</select>{errors.object&&<p className="text-[11px] text-red-600 mt-1">{errors.object}</p>}</div>
        {/* Equipment selector — appears after object is chosen */}
        {objectId&&(
          <div className="mb-4">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Оборудование</label>
            <select value={equipmentId} onChange={e=>setEquipmentId(e.target.value)} className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400">
              <option value="">Не связано с оборудованием</option>
              {EQUIPMENT.filter(e=>OBJECTS.find(o=>o.id===objectId)?.name===e.objectName||true).map(e=><option key={e.id} value={e.id}>{e.name} · {e.inventoryNumber}</option>)}
            </select>
            {selectedEquip&&(
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                <p className="text-[11px] font-bold text-blue-700 mb-1">{selectedEquip.name}</p>
                <div className="flex gap-3 text-[10px] text-blue-600">
                  <span>Модель: {selectedEquip.model}</span>
                  <span>S/N: {selectedEquip.serialNumber}</span>
                </div>
                <p className="text-[10px] text-blue-500 mt-0.5">Последнее ТО: {selectedEquip.lastMaintenance}</p>
              </div>
            )}
          </div>
        )}
        <div className="mb-4"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Категория *</label><select value={category} onChange={e=>{setCategory(e.target.value);setErrors(p=>({...p,category:''}))}} className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400"><option value="">Выберите категорию...</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select>{errors.category&&<p className="text-[11px] text-red-600 mt-1">{errors.category}</p>}</div>
        <div className="mb-4"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Описание *</label><textarea rows={4} value={description} onChange={e=>{setDescription(e.target.value);setErrors(p=>({...p,description:''}))}} placeholder="Опишите проблему подробно..." className="mt-1.5 w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-[13px] text-slate-800 outline-none focus:border-blue-400 resize-none"/>{errors.description&&<p className="text-[11px] text-red-600 mt-1">{errors.description}</p>}</div>
        <div className="mb-4"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Фото</label><div className="mt-1.5 flex gap-2">{!hasPhoto?<><button onClick={()=>setHasPhoto(true)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">📷 Сделать фото</button><button onClick={()=>setHasPhoto(true)} className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">🖼️ Из галереи</button></>:<div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-3 flex items-center gap-2"><span className="text-emerald-600">✓</span><span className="text-[12px] font-semibold text-emerald-700">Фото добавлено</span><button onClick={()=>setHasPhoto(false)} className="ml-auto text-[10px] text-slate-400">Удалить</button></div>}</div></div>
        <div className="mb-4">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Срочность</label>
          {/* Urgency modal */}
          {urgencyModal&&(
            <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center px-6">
              <div className="bg-white rounded-3xl shadow-2xl p-6 w-full">
                <div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0"><span className="text-[24px]">⚡</span></div><div><p className="text-[15px] font-bold text-slate-900">Срочная заявка</p><p className="text-[11px] text-slate-400">Только для экстренных ситуаций</p></div></div>
                <p className="text-[12px] font-bold text-slate-700 mb-2">Используется только если:</p>
                <ul className="space-y-2 mb-5">
                  {['Объект не может работать или работает критически','Существует риск безопасности людей','Существует риск порчи имущества','Существует риск остановки продаж'].map(i=>(
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5"><span className="text-[10px] text-red-600 font-bold">!</span></span>
                      <span className="text-[12px] text-slate-600">{i}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <button onClick={()=>{setUrgencyModal(false);setIsUrgent(false)}} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[13px] font-bold active:scale-95 transition-transform">Отмена</button>
                  <button onClick={()=>{setUrgencyModal(false);setIsUrgent(true)}} className="flex-1 py-3 bg-red-600 text-white rounded-2xl text-[13px] font-bold shadow-md shadow-red-200 active:scale-95 transition-transform">Понятно</button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-1.5 flex gap-2">
            <button onClick={()=>{setIsUrgent(false);setUrgencyReason('')}} className={`flex-1 py-3 rounded-xl text-[13px] font-bold border ${!isUrgent?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>Обычная</button>
            <button onClick={()=>setUrgencyModal(true)} className={`flex-1 py-3 rounded-xl text-[13px] font-bold border ${isUrgent?'bg-red-600 text-white border-red-600':'bg-white text-slate-500 border-slate-200'}`}>⚡ Срочная</button>
          </div>
          {isUrgent&&<div className="mt-3"><label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Причина срочности *</label><textarea rows={2} value={urgencyReason} onChange={e=>{setUrgencyReason(e.target.value);setErrors(p=>({...p,urgency:''}))}} placeholder="Почему срочно? Какой конкретно риск?" className="mt-1.5 w-full bg-white border border-red-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-red-400 resize-none"/>{errors.urgency&&<p className="text-[11px] text-red-600 mt-1">{errors.urgency}</p>}</div>}
        </div>
        <button onClick={submit} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[15px] font-bold shadow-lg shadow-blue-200">Создать заявку</button>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
function ProfileScreen({push,role,onRoleChange,contour,onContourChange}:{push:(s:Screen)=>void;role:UserRole;onRoleChange:(r:UserRole)=>void;contour:ContourMode;onContourChange:(c:ContourMode)=>void}) {
  const roleLabel={TECHNICIAN:'Техник',CLIENT:'Клиент',ADMIN:'Администратор'}[role]
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <BackHeader title="Профиль" onBack={()=>push({kind:'main',navTab:'home'})}/>
      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
        <div className="bg-white px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md flex-shrink-0"><span className="text-white text-[22px] font-bold">ДК</span></div>
            <div><p className="text-[18px] font-bold text-slate-900">Дмитрий Ковалёв</p><p className="text-[12px] text-slate-400">d.kovalev@servicemanager.ai</p><div className="flex items-center gap-2 mt-1.5"><span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${role==='TECHNICIAN'?'bg-blue-100 text-blue-700':role==='CLIENT'?'bg-emerald-100 text-emerald-700':'bg-violet-100 text-violet-700'}`}>{roleLabel}</span><span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">{contour==='mobile'?'📱 Мобильный':'🖥 Управление'}</span></div></div>
          </div>
        </div>

        <div className="bg-white px-5 py-4 border-b border-slate-100 mt-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Переключить режим</p>
          <div className="flex flex-col gap-2">
            {([['mobile','📱 Мобильная работа','Управление заявками, обходы, чеки'],['management','🖥 Управление компанией','Аналитика, объекты, сотрудники']] as const).map(([k,l,sub])=>(
              <button key={k} onClick={()=>onContourChange(k)} className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${contour===k?'bg-blue-50 border-blue-300':'bg-slate-50 border-slate-200'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${contour===k?'border-blue-600':'border-slate-300'}`}>{contour===k&&<div className="w-2.5 h-2.5 rounded-full bg-blue-600"/>}</div>
                <div><p className={`text-[13px] font-bold ${contour===k?'text-blue-700':'text-slate-700'}`}>{l}</p><p className="text-[11px] text-slate-400">{sub}</p></div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white mt-3 border-b border-slate-100">
          {[['🏢','Компания','company' as const],['⚙️','Настройки','settings' as const]].map(([icon,label,screen],i,arr)=>(
            <button key={label} onClick={()=>push({kind:screen})} className={`w-full flex items-center gap-3 px-5 py-4 active:bg-slate-50 transition-colors ${i<arr.length-1?'border-b border-slate-50':''}`}>
              <span className="text-[18px] w-7 text-center">{icon}</span>
              <span className="flex-1 text-[14px] font-medium text-slate-700 text-left">{label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>

        <div className="bg-amber-50 mx-4 mt-3 rounded-2xl border border-amber-200 px-4 py-3">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-2">Демо: переключить роль</p>
          <div className="flex gap-2">
            {(['TECHNICIAN','CLIENT','ADMIN'] as UserRole[]).map(r=>(
              <button key={r} onClick={()=>onRoleChange(r)}
                className={`flex-1 text-[10px] font-bold py-2 rounded-xl border transition-all active:scale-95 ${role===r?'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200':'bg-white text-slate-500 border-slate-200'}`}>
                {{TECHNICIAN:'Техник',CLIENT:'Клиент',ADMIN:'Админ'}[r]}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-amber-500 mt-1.5">Меняет доступные действия в карточке заявки</p>
        </div>

        <div className="bg-white mt-3"><button className="w-full flex items-center gap-3 px-5 py-4 active:bg-red-50 transition-colors"><span className="text-[18px] w-7 text-center">🚪</span><span className="flex-1 text-[14px] font-medium text-red-600 text-left">Выйти из системы</span></button></div>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Company Screen ───────────────────────────────────────────────────────────
function CompanyScreen({onBack}:{onBack:()=>void}) {
  const stats=[{icon:'🏢',label:'Объектов',val:'4',col:'text-blue-700',bg:'bg-blue-50'},{icon:'👷',label:'Сотрудников',val:'23',col:'text-violet-700',bg:'bg-violet-50'},{icon:'🎫',label:'Активных заявок',val:'14',col:'text-orange-600',bg:'bg-orange-50'},{icon:'🤝',label:'Подрядчиков',val:'6',col:'text-emerald-700',bg:'bg-emerald-50'},{icon:'⏳',label:'На приёмке',val:String(ALL_TICKETS.filter(t=>t.status==='AWAITING_ACCEPTANCE').length),col:'text-amber-700',bg:'bg-amber-50'},{icon:'⚠️',label:'Просрочено',val:String(ALL_TICKETS.filter(t=>t.overdue).length),col:'text-red-700',bg:'bg-red-50'}]
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <BackHeader title="Компания" onBack={onBack}/>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{scrollbarWidth:'none'}}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md"><span className="text-white text-[22px] font-bold">Р</span></div>
          <div><p className="text-[17px] font-bold text-slate-900">ООО «Рестогрупп»</p><p className="text-[12px] text-slate-400">Управляющая компания</p><span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1 inline-block">Активна</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {stats.map(s=><div key={s.label} className={`rounded-2xl p-4 border-transparent border ${s.bg}`}><div className="flex items-center gap-2 mb-1"><span className="text-[18px]">{s.icon}</span><p className="text-[10px] text-slate-400 font-medium">{s.label}</p></div><p className={`text-[28px] font-bold ${s.col}`}>{s.val}</p></div>)}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-4 py-3 border-b border-slate-50">Объекты</p>
          {OBJECTS.map((o,i)=><div key={o.id} className={`flex items-center gap-3 px-4 py-3 ${i<OBJECTS.length-1?'border-b border-slate-50':''}`}><span className="text-[20px]">{o.icon}</span><div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-slate-800">{o.name}</p><p className="text-[10px] text-slate-400 truncate">{o.address}</p></div><span className="text-[11px] font-bold text-slate-600">{o.counts.newCount+o.counts.assigned+o.counts.inWork+o.counts.awaiting} заявок</span></div>)}
        </div>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen({onBack}:{onBack:()=>void}) {
  const [notif,setNotif]=useState(true)
  const [maxEnabled,setMaxEnabled]=useState(true)
  const [darkMode,setDarkMode]=useState(false)
  const Toggle=({on,onToggle}:{on:boolean;onToggle:()=>void})=><button onClick={onToggle} className={`w-11 h-6 rounded-full transition-all flex-shrink-0 ${on?'bg-blue-600':'bg-slate-200'}`}><div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-0.5 ${on?'translate-x-5':''}`}/></button>
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <BackHeader title="Настройки" onBack={onBack}/>
      <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
        <div className="bg-white mt-3 rounded-2xl mx-4 border border-slate-100 overflow-hidden">
          {[{icon:'🔔',label:'Уведомления',sub:'Push-уведомления о заявках',on:notif,fn:()=>setNotif(p=>!p)},{icon:'🤖',label:'MAX Ассистент',sub:'ИИ-помощник для работы',on:maxEnabled,fn:()=>setMaxEnabled(p=>!p)},{icon:'🌙',label:'Тёмная тема',sub:'Изменить оформление',on:darkMode,fn:()=>setDarkMode(p=>!p)}].map((item,i,arr)=>(
            <div key={item.label} className={`flex items-center gap-3 px-4 py-3.5 ${i<arr.length-1?'border-b border-slate-50':''}`}>
              <span className="text-[20px] w-8 text-center">{item.icon}</span>
              <div className="flex-1 min-w-0"><p className="text-[13px] font-semibold text-slate-800">{item.label}</p><p className="text-[11px] text-slate-400">{item.sub}</p></div>
              <Toggle on={item.on} onToggle={item.fn}/>
            </div>
          ))}
        </div>
        <div className="bg-white mt-3 rounded-2xl mx-4 border border-slate-100 overflow-hidden">
          {[{icon:'🌐',label:'Язык',val:'Русский'},{icon:'🆘',label:'Поддержка',val:''}].map((item,i,arr)=>(
            <div key={item.label} className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-slate-50 ${i<arr.length-1?'border-b border-slate-50':''}`}>
              <span className="text-[20px] w-8 text-center">{item.icon}</span>
              <span className="flex-1 text-[13px] font-semibold text-slate-800">{item.label}</span>
              <div className="flex items-center gap-2">{item.val&&<span className="text-[12px] text-slate-400">{item.val}</span>}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
          ))}
        </div>
        <div className="bg-white mt-3 rounded-2xl mx-4 border border-slate-100 px-4 py-4">
          <p className="text-[12px] text-slate-400 text-center">ServiceManager.AI · Версия 2.0.1</p>
          <p className="text-[10px] text-slate-300 text-center mt-0.5">Mobile UX V2 Final</p>
        </div>
        <div className="h-6"/>
      </div>
    </div>
  )
}

// ─── Workspace ────────────────────────────────────────────────────────────────
function ChatTab({ticket}:{ticket:Ticket}) {
  const [msgs,setMsgs]=useState<ChatMsg[]>(INIT_MSGS)
  const [input,setInput]=useState('')
  const scrollRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{const el=scrollRef.current;if(el)el.scrollTop=el.scrollHeight},[msgs])
  const send=()=>{if(!input.trim())return;const t=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});setMsgs(p=>[...p,{id:`u${Date.now()}`,kind:'outgoing',time:t,text:input.trim()}]);setInput('')}
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 bg-[#F7F9FC]" style={{scrollbarWidth:'none'}}>
        <div className="flex flex-col gap-1.5">
          {msgs.map(msg=>{
            if(msg.kind==='ticket-card') return <div key={msg.id} className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm mb-1"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg></div><div className="flex-1"><p className="text-[12px] font-bold text-slate-800 mb-1.5">Заявка #{ticket.number} · {ticket.category}</p><div className="space-y-0.5"><p className="text-[11px] text-slate-600"><span className="text-slate-400">Проблема: </span>{ticket.problem}</p><p className="text-[11px] text-slate-600"><span className="text-slate-400">Объект: </span>{ticket.location}</p>{ticket.priority==='URGENT'&&<div className="flex items-center gap-1.5 mt-1"><span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚡ Срочная</span>{ticket.urgencyReason&&<span className="text-[10px] text-red-500">{ticket.urgencyReason}</span>}</div>}</div></div></div></div>
            if(msg.kind==='system') return <div key={msg.id} className="flex justify-center my-1"><span className="text-[10px] text-slate-400 bg-slate-200/60 px-3 py-1 rounded-full">{msg.text} · {msg.time}</span></div>
            if(msg.kind==='photo') return <div key={msg.id} className="flex justify-end mt-0.5"><div className="max-w-[200px]"><div className="bg-blue-600 rounded-2xl rounded-br-[4px] p-1 overflow-hidden"><img src={msg.url} alt={msg.caption} className="rounded-xl w-full object-cover" style={{height:120}}/><p className="text-[9px] text-blue-200 px-1 pt-1 pb-0.5 text-right">{msg.caption} · {msg.time} ✓✓</p></div></div></div>
            if(msg.kind==='outgoing') return <div key={msg.id} className="flex justify-end mt-0.5"><div className="max-w-[78%] bg-blue-600 rounded-2xl rounded-br-[4px] px-3.5 py-2.5 shadow-sm"><p className="text-[13px] text-white leading-snug">{msg.text}</p><div className="flex items-center justify-end gap-1 mt-0.5"><span className="text-[9px] text-blue-200">{msg.time}</span><svg width="14" height="9" viewBox="0 0 18 11" fill="#93C5FD"><path d="M1 5l4 4L14 1m2 0l-7 8-2-2"/></svg></div></div></div>
            if(msg.kind==='incoming') return <div key={msg.id} className="flex items-end gap-2 mt-0.5"><div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-0.5"><span className="text-[10px] font-bold text-slate-600">{msg.author[0]}</span></div><div className="max-w-[78%]"><p className="text-[9px] text-slate-400 mb-1 ml-1">{msg.author}</p><div className="bg-white rounded-2xl rounded-bl-[4px] px-3.5 py-2.5 shadow-sm border border-slate-100"><p className="text-[13px] text-slate-800 leading-snug">{msg.text}</p><span className="text-[9px] text-slate-400 mt-0.5 block">{msg.time}</span></div></div></div>
            return null
          })}
        </div>
      </div>
      <div className="bg-white border-t border-slate-100 px-3 py-2.5 flex items-end gap-2 flex-shrink-0">
        <button className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>
        <button className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
        <div className="flex-1 bg-slate-100 rounded-2xl px-3 py-2"><input className="w-full bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none" placeholder="Написать сообщение..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}/></div>
        <button onClick={send} className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${input.trim()?'bg-blue-600 shadow-md shadow-blue-200':'bg-slate-200'}`}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
      </div>
    </div>
  )
}

function InfoTab({ticket}:{ticket:Ticket}) {
  const rows=[{e:'🎫',l:'Номер',v:`#${ticket.number}`,st:false},{e:'📌',l:'Статус',v:sLabel(ticket.status),st:true},{e:'📝',l:'Описание',v:ticket.problem,st:false},{e:'👤',l:'Заявитель',v:ticket.requester,st:false},{e:'📞',l:'Телефон',v:ticket.phone,st:false},{e:'📍',l:'Локация',v:ticket.location,st:false},{e:'🏠',l:'Адрес',v:ticket.address,st:false},{e:'🔧',l:'Категория',v:ticket.category,st:false},{e:'⚡',l:'Приоритет',v:ticket.priority==='URGENT'?'Срочный':'Обычный',st:false},...(ticket.urgencyReason?[{e:'🚨',l:'Причина срочности',v:ticket.urgencyReason,st:false}]:[]),{e:'👷',l:'Исполнитель',v:ticket.assignee||'Не назначен',st:false},{e:'⏱️',l:'SLA до',v:ticket.sla!=='—'?`Сегодня, ${ticket.sla}`:'—',st:false},{e:'📅',l:'Создана',v:ticket.created,st:false}]
  return <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{scrollbarWidth:'none'}}><div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">{rows.map((r,i)=><div key={r.l} className={`flex items-start gap-3 px-4 py-3.5 ${i<rows.length-1?'border-b border-slate-50':''}`}><span className="text-[16px] flex-shrink-0 w-6 text-center mt-0.5">{r.e}</span><div className="flex-1 min-w-0"><p className="text-[10px] text-slate-400 font-medium mb-0.5">{r.l}</p>{r.st?<span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${sBadge(ticket.status)}`}>{r.v}</span>:<p className="text-[13px] font-semibold text-slate-800 leading-snug">{r.v}</p>}</div></div>)}</div></div>
}

function PhotosTab({onOpenPhoto}:{onOpenPhoto:(s:string)=>void}) {
  return <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50" style={{scrollbarWidth:'none'}}>{(['issue','report'] as const).map(purpose=><div key={purpose} className="mb-4"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">{purpose==='issue'?'Фото проблемы':'Фото выполненной работы'}</p><div className="grid grid-cols-2 gap-2">{PHOTOS_DATA.filter(p=>p.purpose===purpose).map(p=><div key={p.id} onClick={()=>onOpenPhoto(p.full)} className="relative rounded-2xl overflow-hidden bg-slate-200 cursor-pointer active:scale-[0.97] shadow-sm" style={{height:120}}><img src={p.thumb} alt={p.label} className="w-full h-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/><p className="absolute bottom-2 left-2 text-[10px] text-white font-semibold">{p.label}</p>{purpose==='report'&&<span className="absolute top-2 right-2 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">Отчёт</span>}</div>)}</div></div>)}<div className="grid grid-cols-2 gap-2"><button className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-400" style={{height:90}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span className="text-[10px] font-semibold">Сделать фото</span></button><button className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-400" style={{height:90}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span className="text-[10px] font-semibold">Из галереи</span></button></div></div>
}

function ActionsTab({ticket,role,addToast,onViewPhotos}:{ticket:Ticket;role:UserRole;addToast:(t:string,tp?:ToastMsg['type'])=>void;onViewPhotos?:()=>void}) {
  const [rejectModal,setRejectModal]=useState<{comment:string;hasPhoto:boolean;err:string}|null>(null)
  const [done,setDone]=useState<Set<string>>(new Set())
  const tap=(id:string)=>setDone(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n})
  const Btn=({id,label,icon,danger,secondary}:{id:string;label:string;icon:string;danger?:boolean;secondary?:boolean})=>(
    <button onClick={()=>{tap(id);if(!secondary&&!danger)addToast(label,'success')}} className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl font-semibold text-[14px] transition-all active:scale-[0.97] ${done.has(id)?'bg-emerald-50 text-emerald-700 border-2 border-emerald-200':danger?'bg-red-50 text-red-700 border-2 border-red-200':secondary?'bg-white text-slate-700 border border-slate-200 shadow-sm':'bg-blue-600 text-white shadow-lg shadow-blue-200'}`}>
      <span className="text-[20px]">{done.has(id)?'✅':icon}</span><span>{done.has(id)?'Выполнено':label}</span>
    </button>
  )
  const roleLabel={TECHNICIAN:'Техник',CLIENT:'Клиент',ADMIN:'Администратор'}[role]
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {rejectModal&&(
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5">
            <div className="flex items-center justify-between mb-3"><h3 className="text-[15px] font-bold">Не принять работу</h3><button onClick={()=>setRejectModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 mb-4 flex items-start gap-2"><span>⚠️</span><p className="text-[11px] text-orange-700 font-medium">Комментарий и фото обязательны. Заявка вернётся исполнителю.</p></div>
            {rejectModal.err&&<p className="text-[11px] text-red-600 mb-2">{rejectModal.err}</p>}
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Причина отказа *</label>
            <textarea className="mt-1.5 mb-3 w-full bg-slate-50 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none border border-slate-200 resize-none" rows={3} placeholder="Что не принято?" value={rejectModal.comment} onChange={e=>setRejectModal(p=>p?({...p,comment:e.target.value,err:''}):(p))}/>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Фото *</label>
            <div className="mt-1.5 mb-4">{!rejectModal.hasPhoto?<button onClick={()=>setRejectModal(p=>p?({...p,hasPhoto:true}):(p))} className="w-full py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-600">📷 Добавить фото</button>:<div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2"><span className="text-emerald-600">✓</span><span className="text-[12px] font-semibold text-emerald-700">Фото добавлено</span></div>}</div>
            <button onClick={()=>{if(rejectModal.comment.length<3){setRejectModal(p=>p?({...p,err:'Комментарий обязателен'}):(p));return}if(!rejectModal.hasPhoto){setRejectModal(p=>p?({...p,err:'Фото обязательно'}):(p));return}addToast('Заявка отправлена на доработку','info');setRejectModal(null)}} className={`w-full py-3.5 rounded-2xl font-bold text-[14px] ${rejectModal.comment.length>=3&&rejectModal.hasPhoto?'bg-red-600 text-white shadow-lg shadow-red-200':'bg-slate-100 text-slate-400'}`}>Отправить на доработку</button>
          </div>
        </div>
      )}
      <div className="bg-white border-b border-slate-100 px-4 py-2 flex-shrink-0 flex items-center gap-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Роль:</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role==='TECHNICIAN'?'bg-blue-100 text-blue-700':role==='CLIENT'?'bg-emerald-100 text-emerald-700':'bg-violet-100 text-violet-700'}`}>{roleLabel}</span>
        <span className="mx-1 text-slate-200">·</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sBadge(ticket.status)}`}>{sLabel(ticket.status)}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 flex flex-col gap-3" style={{scrollbarWidth:'none'}}>
        {role==='TECHNICIAN'&&ticket.status==='NEW'&&<><Btn id="claim" label="Взять в работу" icon="🙋"/><div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100 flex items-start gap-3"><span className="text-[16px]">ℹ️</span><p className="text-[12px] text-slate-500">Нажмите «Взять в работу», чтобы принять заявку.</p></div></>}
        {role==='TECHNICIAN'&&ticket.status==='ASSIGNED'&&<><Btn id="start" label="Начать работу" icon="▶️"/><div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100"><p className="text-[12px] text-slate-500">Подтвердите, что вы на объекте.</p></div></>}
        {role==='TECHNICIAN'&&ticket.status==='IN_PROGRESS'&&<><Btn id="close" label="Отправить на приёмку" icon="✅"/><Btn id="photo" label="Добавить фото отчёта" icon="📷" secondary/><Btn id="comment" label="Написать комментарий" icon="💬" secondary/></>}
        {role==='TECHNICIAN'&&ticket.status==='AWAITING_ACCEPTANCE'&&<div className="bg-amber-50 rounded-2xl px-4 py-6 border border-amber-100 flex flex-col items-center gap-3 text-center"><span className="text-[48px]">⏳</span><p className="text-[15px] font-bold text-amber-800">Работа отправлена на приёмку</p><p className="text-[12px] text-amber-600 leading-relaxed">Ожидайте решения клиента.</p></div>}
        {role==='ADMIN'&&<>
          {(ticket.status==='NEW'||ticket.status==='ASSIGNED')&&<><Btn id="self" label="Взять заявку себе" icon="🙋"/><Btn id="assign" label="Назначить исполнителя" icon="👷" secondary/></>}
          {ticket.status==='ASSIGNED'&&<Btn id="reassign" label="Переназначить" icon="🔄" secondary/>}
          {/* Change priority */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">Изменить приоритет</p>
            <div className="flex gap-2">
              <button onClick={()=>addToast('Приоритет: Обычный','info')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${ticket.priority!=='URGENT'?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>Обычный</button>
              <button onClick={()=>addToast('Приоритет: Срочный','info')} className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold border transition-all ${ticket.priority==='URGENT'?'bg-red-600 text-white border-red-600':'bg-white text-slate-500 border-slate-200'}`}>⚡ Срочный</button>
            </div>
          </div>
          {/* Change deadline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">Изменить срок (SLA)</p>
            <input type="datetime-local" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 outline-none focus:border-blue-400" defaultValue="2025-06-20T16:30"/>
            <button onClick={()=>addToast('Срок обновлён','success')} className="mt-2 w-full py-2.5 bg-blue-600 text-white rounded-xl text-[12px] font-bold">Обновить срок</button>
          </div>
          {(ticket.status==='NEW'||ticket.status==='ASSIGNED')&&<div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2.5 border-b border-slate-50">Доступные техники</p>{[['ДК','Дмитрий Ковалёв','Климат, Электрика',true],['МП','Михаил Петров','Сантехника, Холодильное',true],['АН','Алексей Никитин','Лифты, Вентиляция',false]].map(([abbr,name,spec,free],i,arr)=><div key={name} className={`flex items-center gap-3 px-4 py-3 ${i<arr.length-1?'border-b border-slate-50':''}`}><div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-[11px] font-bold text-blue-700">{abbr}</span></div><div className="flex-1"><p className="text-[12px] font-semibold text-slate-800">{name}</p><p className="text-[10px] text-slate-400">{spec}</p></div><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${free?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-400'}`}>{free?'Свободен':'Занят'}</span></div>)}</div>}
        </>}
        {role==='CLIENT'&&ticket.status==='AWAITING_ACCEPTANCE'&&<>
          <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 flex items-start gap-3"><span className="text-[16px]">🔔</span><p className="text-[12px] text-blue-700 font-medium">Исполнитель завершил работу. Проверьте результат и фото.</p></div>
          <Btn id="accept" label="Принять работу" icon="✅"/>
          <button onClick={()=>onViewPhotos?.()} className="w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl font-semibold text-[14px] bg-white text-slate-700 border border-slate-200 shadow-sm active:scale-[0.97]"><span className="text-[20px]">🖼️</span>Посмотреть фото работ</button>
          <button onClick={()=>setRejectModal({comment:'',hasPhoto:false,err:''})} className="w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl font-semibold text-[14px] bg-red-50 text-red-700 border-2 border-red-200 active:scale-[0.97]"><span className="text-[20px]">↩️</span>Не принять работу</button>
          <div className="bg-orange-50 rounded-2xl px-4 py-3 border border-orange-100 flex items-start gap-3"><span className="text-[14px]">⚠️</span><p className="text-[11px] text-orange-700">Комментарий и фото обязательны при отказе.</p></div>
        </>}
        {role==='CLIENT'&&ticket.status!=='AWAITING_ACCEPTANCE'&&<div className="bg-slate-50 rounded-2xl px-4 py-6 border border-slate-100 flex flex-col items-center gap-3 text-center"><span className="text-[40px]">📋</span><p className="text-[13px] font-semibold text-slate-600">{sLabel(ticket.status)}</p><p className="text-[12px] text-slate-400">Действия доступны, когда заявка на приёмке.</p></div>}
        <div className="border-t border-slate-200 pt-3 mt-1">
          <button onClick={()=>addToast(`Акт по заявке #${ticket.number} сформирован (PDF)`,'success')} className="w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl font-semibold text-[13px] bg-white text-slate-700 border border-slate-200 shadow-sm active:scale-[0.97]">
            <span className="text-[20px]">📄</span>Сформировать акт выполненных работ
          </button>
        </div>
      </div>
    </div>
  )
}

function WorkspaceScreen({ticket,onBack,role,addToast}:{ticket:Ticket;onBack:()=>void;role:UserRole;addToast:(t:string,tp?:ToastMsg['type'])=>void}) {
  const [tab,setTab]=useState<WorkspaceTab>('chat')
  const [lightbox,setLightbox]=useState<string|null>(null)
  const labels:Record<WorkspaceTab,string>={chat:'Чат',info:'Инфо',photos:'Фото',actions:'Действия'}
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {lightbox&&<div className="absolute inset-0 bg-black/95 z-50 flex flex-col" onClick={()=>setLightbox(null)}><div className="flex items-center justify-between px-4 py-3"><button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button><span className="text-white text-[12px]">Фото</span><div className="w-8"/></div><div className="flex-1 flex items-center justify-center p-4"><img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-xl"/></div></div>}
      <div className="bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <div className="flex-1 min-w-0"><div className="flex items-center gap-1.5 mb-0.5"><span className="text-[13px] font-bold text-slate-900">#{ticket.number}</span><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${sBadge(ticket.status)}`}>{sLabel(ticket.status)}</span>{ticket.priority==='URGENT'&&<span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full flex-shrink-0">⚡</span>}{ticket.overdue&&<span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">просрочено</span>}</div><p className="text-[11px] text-slate-500 truncate">{ticket.problem}</p></div>
          <div className="flex items-center gap-2 flex-shrink-0"><div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/><span className="text-[9px] text-emerald-600 font-bold">онлайн</span></div><button className="relative w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"/></button></div>
        </div>
        <div className="flex">{(['chat','info','photos','actions'] as WorkspaceTab[]).map(t=><button key={t} onClick={()=>setTab(t)} className={`flex-1 py-2.5 text-[12px] font-semibold border-b-2 transition-all ${tab===t?'text-blue-600 border-blue-600':'text-slate-400 border-transparent'}`}>{labels[t]}</button>)}</div>
      </div>
      {tab==='chat'&&<ChatTab ticket={ticket}/>}
      {tab==='info'&&<InfoTab ticket={ticket}/>}
      {tab==='photos'&&<PhotosTab onOpenPhoto={setLightbox}/>}
      {tab==='actions'&&<ActionsTab ticket={ticket} role={role} addToast={addToast} onViewPhotos={()=>setTab('photos')}/>}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screens,setScreens]=useState<Screen[]>([{kind:'main',navTab:'home'}])
  const [role,setRole]=useState<UserRole>('TECHNICIAN')
  const [contour,setContour]=useState<ContourMode>('mobile')
  const [toasts,setToasts]=useState<ToastMsg[]>([])
  const toastId=useRef(0)

  const current=screens[screens.length-1]
  const push=useCallback((s:Screen)=>setScreens(p=>[...p,s]),[])
  const pop=useCallback(()=>setScreens(p=>p.length>1?p.slice(0,-1):p),[])
  const addToast=useCallback((text:string,type:ToastMsg['type']='success')=>{const id=++toastId.current;setToasts(p=>[...p,{id,text,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500)},[])

  const navTo=(navTab:NavTab)=>setScreens([{kind:'main',navTab}])
  const currentNavTab=current.kind==='main'?current.navTab:'home'
  const showBottomNav=current.kind==='main'

  function renderScreen() {
    if(current.kind==='workspace') return <WorkspaceScreen ticket={current.ticket} onBack={pop} role={role} addToast={addToast}/>
    if(current.kind==='create') return <CreateTicketScreen onBack={pop} addToast={addToast}/>
    if(current.kind==='awaiting') return <AwaitingScreen onOpenTicket={t=>push({kind:'workspace',ticket:t})} push={push} addToast={addToast}/>
    if(current.kind==='profile') return <ProfileScreen push={push} role={role} onRoleChange={r=>{setRole(r);addToast(`Роль изменена: ${{TECHNICIAN:'Техник',CLIENT:'Клиент',ADMIN:'Администратор'}[r]}`,'success')}} contour={contour} onContourChange={c=>{setContour(c);if(c==='management')addToast('Переключение в управленческий контур','info')}}/>
    if(current.kind==='company') return <CompanyScreen onBack={pop}/>
    if(current.kind==='settings') return <SettingsScreen onBack={pop}/>
    if(current.kind==='template-constructor') return <TemplateConstructorScreen onBack={pop} addToast={addToast}/>
    if(current.kind==='equipment-detail') return <EquipmentDetailScreen equipment={current.equipment} onBack={pop} addToast={addToast}/>
    if(current.kind==='planning') return <PlanningScreen onBack={pop} addToast={addToast}/>
    if(current.kind==='add-equipment') return <AddEquipmentScreen onBack={pop} addToast={addToast}/>
    if(current.kind==='main') {
      const tab=current.navTab
      if(tab==='home') return <HomeScreen onOpenTicket={t=>push({kind:'workspace',ticket:t})} role={role} push={push} addToast={addToast}/>
      if(tab==='patrols') return <PatrolsScreen addToast={addToast} push={push}/>
      if(tab==='chats') return <ChatsScreen onOpenTicket={t=>push({kind:'workspace',ticket:t})} role={role}/>
      if(tab==='analytics') return <AnalyticsScreen push={push}/>
    }
    return null
  }

  const navDefs=[
    {id:'home',label:'Главная',icon:(a:boolean)=><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a?'#2563EB':'#94A3B8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>},
    {id:'patrols',label:'Обходы',icon:(a:boolean)=><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a?'#2563EB':'#94A3B8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>},
    {id:'create',label:'',icon:null},
    {id:'chats',label:'Чаты',icon:(a:boolean)=><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a?'#2563EB':'#94A3B8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>},
    {id:'analytics',label:'Аналитика',icon:(a:boolean)=><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={a?'#2563EB':'#94A3B8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="13" width="3" height="5"/></svg>},
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0f1f4a] to-blue-950 flex flex-col items-center justify-center p-6 gap-4">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold text-blue-400 tracking-widest uppercase">ServiceManager.AI</span>
        <span className="text-slate-600">·</span>
        <span className="text-[11px] text-slate-500">Mobile UX V2 Final</span>
      </div>

      <div className="relative w-[390px] flex-shrink-0" style={{height:844}}>
        <div className="absolute inset-0 rounded-[46px] bg-blue-500/10 blur-2xl scale-105 pointer-events-none"/>
        <div className="absolute inset-0 bg-slate-800 rounded-[46px] shadow-2xl shadow-black/60"/>
        <div className="absolute inset-[6px] bg-white rounded-[40px] overflow-hidden flex flex-col">
          <div className="flex-shrink-0 bg-white flex justify-center pt-3 pb-1"><div className="w-28 h-[34px] bg-slate-900 rounded-full flex items-center justify-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-700"/><div className="w-1 h-1 rounded-full bg-slate-600"/></div></div>
          <StatusBar/>
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 relative">
            <ToastStack toasts={toasts} onRemove={id=>setToasts(p=>p.filter(t=>t.id!==id))}/>
            {renderScreen()}
            {showBottomNav&&(
              <div className="flex-shrink-0 bg-white border-t border-slate-100">
                <div className="flex items-center justify-around px-1 pt-2 pb-5">
                  {navDefs.map(item=>{
                    if(item.id==='create') return <button key="create" onClick={()=>push({kind:'create'})} className="flex flex-col items-center"><div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-300/50 -mt-5 active:scale-95 transition-transform"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div></button>
                    const isActive=currentNavTab===item.id
                    return <button key={item.id} onClick={()=>navTo(item.id as NavTab)} className="flex flex-col items-center gap-1 min-w-[52px] py-0.5 active:scale-95 transition-transform">{item.icon&&item.icon(isActive)}<span className={`text-[10px] font-semibold ${isActive?'text-blue-600':'text-slate-400'}`}>{item.label}</span></button>
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 text-center max-w-[360px] leading-relaxed">
        V2 Final · Главная → Объект → Заявка · Аватар → Профиль + смена контура<br/>
        Обходы с чеклистами · Архив в Чатах · Чеки с формой · Акты в Действиях · Toast-уведомления
      </p>
    </div>
  )
}
