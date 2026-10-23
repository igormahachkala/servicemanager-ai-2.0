# Браузерная проверка навигации заявок (TUX-01…04)

Playwright против `vite` dev-сервера с подменой API (`mock.cjs`). Сервер
и база не нужны, в CI набор не входит: playwright не числится в
зависимостях web.

Что проверяется (112 проверок):

- источники Board, Home, «На приёмке», «Мои заявки», Chats, Rounds,
  Notifications;
- desktop, mobile (`/m`) и MAX (`/max`, эмуляция `window.WebApp`);
- «Назад» и браузерные Back/Forward: шаг по истории, тот же URL,
  подпись раздела;
- фильтры, поиск и вкладки, которых нет в URL;
- прокрутка, в том числе при ответах API с задержкой 500–700 мс;
- прямые ссылки и push deep-link: сообщение `push-navigate` от
  Service Worker;
- подделанный `history.state` с чужим или внешним `returnTo`;
- область в запросах к API (`linkedClientCompanyId`, `companyId`).

Мок отвечает 404 на заявку клиента, если поставщик запрашивает её без
`linkedClientCompanyId` клиента. Так ведёт себя сервер.

Запуск:

    cd web && npx vite --port 5398 --strictPort &
    node e2e/ticket-nav/run.cjs <путь к playwright-core> [фильтр сценария]

Адрес сервера задаётся переменной `TNAV_BASE`. Одновременно запускать
только один набор: два Chromium на одной машине дают ложные таймауты.
