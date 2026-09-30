import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "../../lib/api";

type PreferenceInput = {
  eventType: string;
  contour: api.NotificationSettingsContour;
  channel: api.NotificationSettingsChannel;
};

function pendingKeyOf(input: PreferenceInput) {
  return `${input.contour}:${input.eventType}:${input.channel}`;
}

export function NotificationPreferencesPanel() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ["notification-settings"],
    queryFn: api.getNotificationSettings,
  });

  function applyResult(next: api.NotificationSettings) {
    queryClient.setQueryData(["notification-settings"], next);
    setActionError(null);
  }

  const disableM = useMutation({
    mutationFn: (input: PreferenceInput) =>
      api.setNotificationPreference({ ...input, enabled: false }),
    onSuccess: applyResult,
    onError: (error: any) =>
      setActionError(error?.message || "Не удалось сохранить настройку"),
    onSettled: () => setPending(null),
  });

  const resetM = useMutation({
    mutationFn: (input: PreferenceInput) =>
      api.clearNotificationPreference(input),
    onSuccess: applyResult,
    onError: (error: any) =>
      setActionError(error?.message || "Не удалось включить уведомление"),
    onSettled: () => setPending(null),
  });

  if (settingsQ.isLoading) {
    return (
      <div className="panel" aria-busy="true">
        <h3>Уведомления</h3>
        <div className="muted">Загружаем настройки…</div>
      </div>
    );
  }
  if (settingsQ.isError) {
    return (
      <div className="panel">
        <h3>Уведомления</h3>
        <div className="alert" role="alert">
          {(settingsQ.error as any)?.message ||
            "Не удалось загрузить настройки уведомлений"}
        </div>
        <button type="button" onClick={() => settingsQ.refetch()}>
          Повторить
        </button>
      </div>
    );
  }

  const contours = Array.isArray(settingsQ.data?.contours)
    ? settingsQ.data.contours
    : [];
  const busy = disableM.isPending || resetM.isPending;

  return (
    <div className="panel">
      <h3>Уведомления</h3>
      <div className="muted small notifPrefIntro">
        Здесь можно отключить отдельные уведомления в системе. Push-уведомления
        настраиваются отдельно.
      </div>
      {actionError ? (
        <div className="alert" role="alert">
          {actionError}
        </div>
      ) : null}

      {!contours.length ? (
        <div className="muted">
          Для вашей роли и текущих рабочих контуров нет настраиваемых
          уведомлений.
        </div>
      ) : (
        contours.map((section) => (
          <section key={section.contour} className="notifPrefContour">
            <h4 className="notifPrefContourTitle">{section.labelRu}</h4>
            {section.groups.map((group) => (
              <div key={group.key} className="notifPrefGroup">
                <h5 className="notifPrefGroupTitle">{group.titleRu}</h5>
                <ul className="notifPrefList">
                  {group.events.map((event) => {
                    const input: PreferenceInput = {
                      eventType: event.eventType,
                      contour: section.contour,
                      channel: event.channel,
                    };
                    const key = pendingKeyOf(input);
                    const checked = event.state !== "OFF";
                    return (
                      <li key={event.eventType} className="notifPrefRow">
                        <div className="notifPrefRowText">
                          <div className="notifPrefRowLabel">
                            {event.labelRu}
                          </div>
                          <div className="muted small">
                            {event.descriptionRu}
                          </div>
                        </div>
                        <div className="notifPrefRowControls">
                          <label className="notifPrefToggle">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy}
                              aria-label={`${event.labelRu} — ${section.labelRu}`}
                              onChange={(change) => {
                                setPending(key);
                                if (change.target.checked) resetM.mutate(input);
                                else disableM.mutate(input);
                              }}
                            />
                            <span>{checked ? "Включено" : "Отключено"}</span>
                          </label>
                          <span className="muted small" aria-live="polite">
                            {pending === key && busy
                              ? "Сохраняем…"
                              : event.state === "INHERITED"
                                ? "По умолчанию"
                                : "Личная настройка"}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
