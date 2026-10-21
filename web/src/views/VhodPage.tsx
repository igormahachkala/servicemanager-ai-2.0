import { Link } from 'react-router-dom'
import { LOGO_MARK } from './VhodLogo'

const MANAGEMENT_LOGIN = '/login?workspace=management'
const MOBILE_LOGIN = '/login?workspace=mobile'

const MAX_URL =
  'https://max.ru/u/f9LHodD0cOK5RekhU6YpvCy9QKHKkKKliR443WCkSqKloC-TTH8eD_1szK0'

const css = `
.vh{--blue:#123A8C;--blue-d:#0d2c6b;--ink:#1a1a1a;--mut:#6f7788;--line:#dde2ea;--tint:#f5f7fa;
  color:var(--ink);background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.vh *{box-sizing:border-box}
.vh a{color:inherit}
.vh a:focus-visible{outline:2px solid var(--blue);outline-offset:3px;border-radius:2px}
.vh-wrap{max-width:1040px;margin:0 auto;padding:0 24px}
.vh-top{border-bottom:1px solid var(--line)}
.vh-top .vh-wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:72px}
.vh-brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.vh-brand img{display:block;border-radius:7px}
.vh-brand b{font-size:17px;letter-spacing:-.01em;line-height:1.2;display:block}
.vh-brand small{color:var(--mut);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.vh-nav{display:flex;gap:22px;font-size:14px;color:var(--mut)}
.vh-nav a{text-decoration:none}
.vh-nav a:hover{color:var(--ink)}
.vh-entry{padding-top:52px;padding-bottom:6px}
.vh-entry h1{margin:0 0 8px;font-size:clamp(27px,4.2vw,40px);line-height:1.14;font-weight:700;letter-spacing:-.02em}
.vh-entry .vh-lead{margin:0 0 30px;color:var(--mut);max-width:54ch}
.vh-doors{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.vh-door{display:flex;flex-direction:column;text-decoration:none;background:#fff;border:1px solid var(--line);
  border-radius:12px;padding:26px;transition:border-color .15s,box-shadow .15s}
.vh-door:hover{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue)}
.vh-door .vh-who{font-size:13px;color:var(--mut);margin-bottom:12px}
.vh-door h2{margin:0 0 12px;font-size:22px;font-weight:700;letter-spacing:-.015em}
.vh-door ul{margin:0 0 22px;padding-left:18px;color:var(--mut);font-size:15px}
.vh-door li{margin-bottom:5px}
.vh-door .vh-go{margin-top:auto;align-self:flex-start;background:var(--blue);color:#fff;padding:11px 22px;
  border-radius:8px;font-size:15px;font-weight:600;min-height:44px;display:flex;align-items:center}
.vh-door:hover .vh-go{background:var(--blue-d)}
.vh-about{background:var(--tint);border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:52px}
.vh-about .vh-wrap{padding:44px 24px}
.vh-h3{margin:0 0 22px;font-size:20px;font-weight:700;letter-spacing:-.01em}
.vh-about .vh-h3{font-size:clamp(24px,3.4vw,32px);letter-spacing:-.02em}
.vh-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:22px;margin:0 0 28px;padding:0;list-style:none}
.vh-stats .vh-num{display:block;font-size:32px;line-height:1.1;font-weight:700;color:var(--blue);letter-spacing:-.02em}
.vh-stats .vh-lbl{display:block;margin-top:5px;font-size:14px;color:var(--mut)}
.vh-about p{margin:0 0 12px;max-width:62ch;color:#333}
.vh-tags{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:24px 0 0;padding:0}
.vh-tags li{background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:14px;color:#333}
.vh-sec{padding:48px 0}
.vh-can{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0 44px;margin:0;padding:0;list-style:none}
.vh-can li{padding:12px 0;border-top:1px solid var(--line);color:var(--mut);font-size:15px}
.vh-can b{display:block;color:var(--ink);font-weight:600;font-size:16px}
.vh-cta{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.vh-card{border:1px solid var(--line);border-radius:12px;padding:26px}
.vh-card.vh-blue{background:var(--blue);border-color:var(--blue);color:#fff}
.vh-card.vh-blue p{color:#ccd6ee}
.vh-card h3{margin:0 0 8px;font-size:19px;font-weight:700;letter-spacing:-.01em}
.vh-card p{margin:0 0 18px;color:var(--mut);font-size:15px}
.vh-acts{display:flex;flex-wrap:wrap;gap:10px}
.vh-acts a{text-decoration:none;border-radius:8px;padding:11px 18px;font-size:15px;font-weight:600;min-height:44px;
  display:flex;align-items:center;border:1px solid var(--line);color:var(--ink)}
.vh-blue .vh-acts a{border-color:rgba(255,255,255,.45);color:#fff}
.vh-blue .vh-acts a.vh-primary{background:#fff;color:var(--blue);border-color:#fff}
.vh-blue .vh-acts a:hover{background:rgba(255,255,255,.12)}
.vh-blue .vh-acts a.vh-primary:hover{background:#eef2fa}
.vh-card:not(.vh-blue) .vh-acts a:hover{border-color:var(--blue);color:var(--blue)}
.vh-install{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:30px}
.vh-install h4{margin:0 0 10px;font-size:15px;font-weight:700}
.vh-install ol{margin:0;padding-left:20px;color:var(--mut);font-size:15px}
.vh-install li{margin-bottom:6px}
.vh-push{margin:22px 0 0;padding:14px 16px;background:var(--tint);border-radius:10px;color:var(--mut);font-size:14px}
.vh-rule{border:0;border-top:1px solid var(--line);margin:0}
.vh-help{display:flex;flex-wrap:wrap;gap:10px}
.vh-help a{text-decoration:none;border:1px solid var(--line);border-radius:8px;padding:11px 16px;font-size:15px;
  color:var(--mut);min-height:44px;display:flex;align-items:center}
.vh-help a:hover{border-color:var(--blue);color:var(--blue)}
.vh-foot{background:var(--tint);border-top:1px solid var(--line);padding:28px 0 44px;font-size:14px;color:var(--mut)}
.vh-legal{display:flex;flex-wrap:wrap;gap:8px 20px;margin-bottom:14px}
.vh-legal a{text-decoration:none}
.vh-legal a:hover{color:var(--blue);text-decoration:underline}
.vh-req{line-height:1.7}
@media (prefers-reduced-motion:reduce){.vh *{transition:none!important}}
`

export function VhodPage() {
  return (
    <div className="vh">
      <style>{css}</style>

      <header className="vh-top">
        <div className="vh-wrap">
          <Link className="vh-brand" to="/">
            <img src={LOGO_MARK} alt="Сервис Менеджер" width={40} height={40} />
            <span>
              <b>Сервис Менеджер</b>
              <small>обслуживание объектов</small>
            </span>
          </Link>
          <nav className="vh-nav">
            <a href="#ustanovka">Установка на{'\u00A0'}телефон</a>
            <a href="#podderzhka">Поддержка</a>
          </nav>
        </div>
      </header>

      <main>
        <div className="vh-wrap vh-entry">
          <h1>Заявки на{'\u00A0'}обслуживание — в{'\u00A0'}одном месте</h1>
          <p className="vh-lead">
            Выберите, где вы{'\u00A0'}работаете. Логин и{'\u00A0'}пароль выдаёт администратор вашей компании.
          </p>

          <div className="vh-doors">
            <Link className="vh-door" to={MANAGEMENT_LOGIN}>
              <span className="vh-who">Диспетчер, мастер, руководитель</span>
              <h2>Управленческая часть</h2>
              <ul>
                <li>Приём и{'\u00A0'}распределение заявок</li>
                <li>Контроль сроков и{'\u00A0'}статусов</li>
                <li>Отчёты по{'\u00A0'}объектам и{'\u00A0'}исполнителям</li>
              </ul>
              <span className="vh-go">Войти</span>
            </Link>

            <Link className="vh-door" to={MOBILE_LOGIN}>
              <span className="vh-who">Мастер, диспетчер, клиент</span>
              <h2>Мобильная версия</h2>
              <ul>
                <li>Мастер — свои заявки, фото и{'\u00A0'}чат</li>
                <li>Диспетчер — приём заявок с{'\u00A0'}телефона</li>
                <li>Клиент — подать заявку и{'\u00A0'}видеть статус</li>
              </ul>
              <span className="vh-go">Войти</span>
            </Link>
          </div>
        </div>

        <div className="vh-about">
          <div className="vh-wrap">
            <h3 className="vh-h3">С{'\u00A0'}вас заявка — с{'\u00A0'}нас решение</h3>
            <ul className="vh-stats">
              <li>
                <span className="vh-num">40</span>
                <span className="vh-lbl">точек на{'\u00A0'}обслуживании</span>
              </li>
              <li>
                <span className="vh-num">4</span>
                <span className="vh-lbl">города: Уфа, Ижевск, Пермь, Чебоксары</span>
              </li>
              <li>
                <span className="vh-num">700+</span>
                <span className="vh-lbl">заявок в{'\u00A0'}месяц</span>
              </li>
              <li>
                <span className="vh-num">до{'\u00A0'}2{'\u00A0'}часов</span>
                <span className="vh-lbl">реакция на{'\u00A0'}срочную заявку</span>
              </li>
            </ul>
            <p>
              База — плановое техобслуживание: регулярные выезды по{'\u00A0'}графику, проверка оборудования, мелкий
              ремонт на{'\u00A0'}месте. Задача простая — чтобы аварий у{'\u00A0'}вас было как{'\u00A0'}можно меньше.
            </p>
            <p>
              А{'\u00A0'}когда что-то ломается — забился слив, встала приточка, не{'\u00A0'}греет фритюр, выбило автомат
              — вам не{'\u00A0'}нужно обзванивать десять мастеров и{'\u00A0'}выяснять, чей это участок. Вы создаёте одну
              заявку. Дальше — наша забота: сделаем сами или{'\u00A0'}привезём проверенного подрядчика,
              за{'\u00A0'}которого отвечаем.
            </p>
            <p>
              Одними поломками не{'\u00A0'}ограничиваемся: берём ремонт под{'\u00A0'}ключ, строим
              и{'\u00A0'}реконструируем. В{'\u00A0'}работе одновременно может быть и{'\u00A0'}замена смесителя, и{'\u00A0'}новое
              крыльцо, и{'\u00A0'}реконструкция склада.
            </p>
            <p>
              Эта платформа — наша собственная разработка под{'\u00A0'}маркой SMA-TECH, и{'\u00A0'}мы сами работаем
              в{'\u00A0'}ней каждый день. Заявка не{'\u00A0'}теряется в{'\u00A0'}переписке: по{'\u00A0'}каждой видно
              исполнителя, срок и{'\u00A0'}фото результата.
            </p>
            <ul className="vh-tags">
              <li>Плановое ТО и{'\u00A0'}мелкий ремонт</li>
              <li>Тепловое оборудование</li>
              <li>Холодильное оборудование</li>
              <li>Кухонное оборудование</li>
              <li>Сантехника и{'\u00A0'}канализация</li>
              <li>Электрика</li>
              <li>Вентиляция и{'\u00A0'}приточно-вытяжные системы</li>
              <li>Ремонт помещений под{'\u00A0'}ключ</li>
              <li>Строительство и{'\u00A0'}реконструкция</li>
            </ul>
          </div>
        </div>

        <div className="vh-wrap">
          <section className="vh-sec">
            <h3 className="vh-h3">Что умеет платформа</h3>
            <ul className="vh-can">
              <li>
                <b>Приём заявок</b>От заказчика, диспетчера или{'\u00A0'}по{'\u00A0'}расписанию
              </li>
              <li>
                <b>Распределение</b>Заявка закреплена за{'\u00A0'}исполнителем: видно, кто и{'\u00A0'}когда
              </li>
              <li>
                <b>Чат и{'\u00A0'}фото</b>Переписка и{'\u00A0'}снимки хранятся внутри заявки
              </li>
              <li>
                <b>Обходы и{'\u00A0'}ППР</b>Плановые работы по{'\u00A0'}графику, а{'\u00A0'}не{'\u00A0'}по{'\u00A0'}памяти
              </li>
              <li>
                <b>Уведомления</b>Заказчик видит статус, исполнитель — новую заявку
              </li>
              <li>
                <b>Отчёты</b>Выгрузка по{'\u00A0'}объектам, срокам и{'\u00A0'}исполнителям
              </li>
            </ul>
          </section>

          <section className="vh-sec" style={{ paddingTop: 0 }}>
            <div className="vh-cta">
              <div className="vh-card vh-blue">
                <h3>Посмотрите платформу в{'\u00A0'}деле</h3>
                <p>
                  Проведём демо на{'\u00A0'}живых заявках — 20{'\u00A0'}минут. Расскажем про{'\u00A0'}цену
                  и{'\u00A0'}сроки подключения. Обслуживаете точки в{'\u00A0'}Уфе, Ижевске, Перми или{'\u00A0'}Чебоксарах — возьмём
                  и{'\u00A0'}обслуживание.
                </p>
                <div className="vh-acts">
                  <a className="vh-primary" href="tel:+79871335744">
                    +7 987 133-57-44
                  </a>
                  <a href={MAX_URL}>Написать в{'\u00A0'}MAX</a>
                  <a href="mailto:servicemanager.ai@gmail.com?subject=Демо Сервис Менеджер">Записаться на{'\u00A0'}демо</a>
                </div>
              </div>
              <div className="vh-card">
                <h3>Сотрудничество</h3>
                <p>
                  Расширяем сеть подрядчиков в{'\u00A0'}наших городах и{'\u00A0'}выходим в{'\u00A0'}новые. Мастерам
                  и{'\u00A0'}бригадам — стабильный поток заявок и{'\u00A0'}понятные условия. Сервисным компаниям —
                  платформа для{'\u00A0'}работы с{'\u00A0'}заявками. Напишите — обсудим.
                </p>
                <div className="vh-acts">
                  <a href="mailto:servicemanager.ai@gmail.com?subject=Сотрудничество">Написать</a>
                </div>
              </div>
            </div>
          </section>

          <hr className="vh-rule" />

          <section className="vh-sec" id="ustanovka">
            <h3 className="vh-h3">Установка на{'\u00A0'}телефон</h3>
            <div className="vh-install">
              <div>
                <h4>iPhone — Safari</h4>
                <ol>
                  <li>Откройте servicemanagerai.ru/m в{'\u00A0'}Safari</li>
                  <li>Нажмите «Поделиться»</li>
                  <li>Выберите «На{'\u00A0'}экран „Домой“»</li>
                </ol>
              </div>
              <div>
                <h4>Android — Chrome</h4>
                <ol>
                  <li>Откройте servicemanagerai.ru/m в{'\u00A0'}Chrome</li>
                  <li>Меню «⋮» в{'\u00A0'}правом верхнем углу</li>
                  <li>Выберите «Установить приложение»</li>
                </ol>
              </div>
            </div>
            <p className="vh-push">
              После установки приложение открывается с{'\u00A0'}иконки, работает в{'\u00A0'}полный экран
              и{'\u00A0'}получает push-уведомления о{'\u00A0'}новых заявках. В{'\u00A0'}браузере push не{'\u00A0'}приходят.
            </p>
          </section>

          <hr className="vh-rule" />

          <section className="vh-sec" id="podderzhka">
            <h3 className="vh-h3">Поддержка</h3>
            <div className="vh-help">
              <a href="tel:+79871335744">+7 987 133-57-44</a>
              <a href={MAX_URL}>Написать в{'\u00A0'}MAX</a>
              <a href="mailto:servicemanager.ai@gmail.com">servicemanager.ai@gmail.com</a>
            </div>
          </section>
        </div>
      </main>

      <footer className="vh-foot">
        <div className="vh-wrap">
          <div className="vh-legal">
            <a href="/privacy.html">Политика обработки персональных данных</a>
            <a href="/soglasie.html">Согласие на{'\u00A0'}обработку</a>
            <a href="/polzovatelskoe-soglashenie.html">Пользовательское соглашение</a>
            <a href="/bezopasnost.html">Безопасность</a>
          </div>
          <div className="vh-req">
            ИП Ермаков Игорь Александрович · ИНН 056001679003 · ОГРНИП 320028000041805
            <br />
            +7 987 133-57-44 · servicemanager.ai@gmail.com
            <br />
            Разработка — SMA-TECH · © 2026 Сервис Менеджер
          </div>
        </div>
      </footer>
    </div>
  )
}
