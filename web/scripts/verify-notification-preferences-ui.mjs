import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const panel = read(
  "src/components/notifications/NotificationPreferencesPanel.tsx",
);
const api = read("src/lib/api.ts");
const desktop = read("src/views/SettingsPage.tsx");
const mobile = read("src/mobile/MobileSettingsPage.tsx");
const compactPanel = panel.replace(/\s+/g, " ");
const checks = [];
const check = (name, run) => {
  run();
  checks.push(name);
};

check(
  "one shared panel is mounted on desktop and native mobile settings",
  () => {
    assert.match(desktop, /NotificationPreferencesPanel/);
    assert.match(mobile, /NotificationPreferencesPanel/);
    assert.doesNotMatch(panel, /managementHomePath|workspace|\/management/);
  },
);

check("event catalogue stays backend-owned", () => {
  assert.doesNotMatch(
    panel,
    /ticket\.(created|assigned|comment_added|status_changed|sla_)/,
  );
  assert.match(panel, /event\.labelRu/);
  assert.match(panel, /event\.descriptionRu/);
});

check(
  "CLIENT PRIMARY and SECONDARY sections are rendered independently",
  () => {
    assert.match(panel, /settingsQ\.data\?\.contours/);
    assert.match(panel, /section\.contour/);
    assert.match(panel, /section\.labelRu/);
    assert.match(panel, /contour: section\.contour/);
  },
);

check("V1 is IN_APP opt-out only", () => {
  assert.match(api, /type NotificationSettingsChannel = 'IN_APP'/);
  assert.match(api, /enabled: false/);
  assert.match(panel, /enabled: false/);
  assert.doesNotMatch(panel, /enabled:\s*(true|change\.target\.checked)/);
  assert.match(panel, /if \(change\.target\.checked\) resetM\.mutate\(input\)/);
  assert.match(panel, /else disableM\.mutate\(input\)/);
});

check(
  "PUSH is explained but never configured by this panel; MAX is absent",
  () => {
    assert.match(compactPanel, /Push-уведомления настраиваются отдельно/);
    assert.doesNotMatch(
      panel,
      /NotificationSettingsChannel.*PUSH|NotificationSettingsChannel.*MAX/,
    );
    assert.doesNotMatch(panel, />MAX</);
  },
);

check("safe loading error empty and save states exist", () => {
  for (const text of [
    "Загружаем настройки…",
    "Повторить",
    "Сохраняем…",
    "нет настраиваемых уведомлений",
  ]) {
    assert.match(compactPanel, new RegExp(text));
  }
  assert.match(panel, /role="alert"/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /aria-label=/);
});

check("no access promise is made by the preference UI", () => {
  assert.doesNotMatch(panel, /получить доступ|открывает доступ/);
});

console.log(
  `verify-notification-preferences-ui: ${checks.length} checks passed`,
);
for (const name of checks) console.log(`  ok  ${name}`);
