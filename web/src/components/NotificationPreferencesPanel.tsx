import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";

type PreferenceMode = "INHERIT" | "ON" | "OFF";
type EditableCell = api.NotificationPreferenceCell & {
  role?: api.Role;
  companyRoleOverrideEnabled?: boolean | null;
  userOverrideEnabled?: boolean | null;
};

type Props = {
  compact?: boolean;
  showCompanyMatrix?: boolean;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function cellKey(
  cell: Pick<EditableCell, "contour" | "role" | "eventType" | "channel">,
) {
  return [cell.contour, cell.role ?? "me", cell.eventType, cell.channel].join(
    ":",
  );
}

function modeFromOverride(value: boolean | null): PreferenceMode {
  if (value === true) return "ON";
  if (value === false) return "OFF";
  return "INHERIT";
}

function valueFromMode(mode: PreferenceMode): boolean | null {
  if (mode === "ON") return true;
  if (mode === "OFF") return false;
  return null;
}

function groupEvents(catalog: api.NotificationPreferenceCatalog | undefined) {
  if (!catalog) return [];
  const byGroup = new Map<
    string,
    { key: string; labelRu: string; events: api.NotificationEventDefinition[] }
  >();
  for (const event of catalog.events) {
    const group = byGroup.get(event.group);
    if (group) {
      group.events.push(event);
    } else {
      byGroup.set(event.group, {
        key: event.group,
        labelRu: event.groupLabelRu,
        events: [event],
      });
    }
  }
  return Array.from(byGroup.values());
}

function PreferenceControl(props: {
  cell: EditableCell;
  busy: boolean;
  disabled?: boolean;
  onChange: (cell: EditableCell, value: boolean | null) => void;
}) {
  const mode = modeFromOverride(props.cell.overrideEnabled);
  const options: Array<{ mode: PreferenceMode; label: string }> = [
    { mode: "INHERIT", label: "Наследуется" },
    { mode: "ON", label: "Включено" },
    { mode: "OFF", label: "Выключено" },
  ];
  const defaultLabel = props.cell.productDefaultEnabled
    ? "включено"
    : "выключено";

  return (
    <div className="notifPreferenceControl">
      <div
        className="notifTriState"
        role="group"
        aria-label="Состояние уведомления"
      >
        {options.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={
              mode === option.mode
                ? "notifTriStateButton notifTriStateButtonActive"
                : "notifTriStateButton"
            }
            disabled={props.disabled || props.busy}
            aria-pressed={mode === option.mode}
            onClick={() =>
              props.onChange(props.cell, valueFromMode(option.mode))
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="notifDefaultHint">По умолчанию: {defaultLabel}</div>
    </div>
  );
}

function PreferenceRows(props: {
  catalog: api.NotificationPreferenceCatalog;
  preferences: EditableCell[];
  savingKey: string | null;
  disabled?: boolean;
  onChange: (cell: EditableCell, value: boolean | null) => void;
}) {
  const groups = useMemo(() => groupEvents(props.catalog), [props.catalog]);
  const channels = props.catalog.channels.filter(
    (channel) => channel.configurableByUser,
  );

  return (
    <div className="notifEventGroups">
      {groups.map((group) => (
        <section key={group.key} className="notifEventGroup">
          <div className="notifEventGroupTitle">{group.labelRu}</div>
          <div className="notifEventRows">
            {group.events.map((event) => (
              <div key={event.key} className="notifEventRow">
                <div className="notifEventInfo">
                  <div className="notifEventLabel">{event.labelRu}</div>
                  <div className="notifEventDescription">
                    {event.descriptionRu}
                  </div>
                </div>
                <div className="notifChannelCells">
                  {channels.map((channel) => {
                    const cell = props.preferences.find(
                      (candidate) =>
                        candidate.eventType === event.key &&
                        candidate.channel === channel.key,
                    );
                    if (!cell) return null;
                    return (
                      <div key={channel.key} className="notifChannelCell">
                        <div className="notifChannelLabel">
                          {channel.labelRu}
                        </div>
                        <PreferenceControl
                          cell={cell}
                          busy={props.savingKey === cellKey(cell)}
                          disabled={props.disabled}
                          onChange={props.onChange}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MaxNotice({
  catalog,
}: {
  catalog?: api.NotificationPreferenceCatalog;
}) {
  const maxChannel = catalog?.channels.find((channel) => channel.key === "MAX");
  if (!maxChannel) return null;
  const description = maxChannel.descriptionRu.replace(/[.]+$/, "");
  return (
    <div className="notifMaxNotice">
      <strong>{maxChannel.labelRu}</strong>
      <span>
        {description}. Индивидуальный переключатель не показывается.
      </span>
    </div>
  );
}

export function NotificationPreferencesPanel({
  compact = false,
  showCompanyMatrix = true,
}: Props) {
  const queryClient = useQueryClient();
  const [companyContourKey, setCompanyContourKey] = useState<
    api.NotificationContour | ""
  >("");
  const [companyRoleKey, setCompanyRoleKey] = useState<api.Role | "">("");
  const [personalContourKey, setPersonalContourKey] = useState<
    api.NotificationContour | ""
  >("");
  const [companySavingKey, setCompanySavingKey] = useState<string | null>(null);
  const [personalSavingKey, setPersonalSavingKey] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const catalogQ = useQuery({
    queryKey: ["notification-preference-catalog"],
    queryFn: api.notificationPreferenceCatalog,
  });
  const companyMatrixQ = useQuery({
    queryKey: ["notification-company-role-matrix"],
    queryFn: () => api.companyNotificationRoleMatrix(),
    enabled: showCompanyMatrix && !!catalogQ.data?.canManageCompanyRoleMatrix,
  });
  const personalQ = useQuery({
    queryKey: ["notification-preferences-me"],
    queryFn: api.myNotificationPreferences,
  });

  const companyMutation = useMutation({
    mutationFn: api.updateCompanyNotificationRolePreference,
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-company-role-matrix"], data);
      void queryClient.invalidateQueries({
        queryKey: ["notification-preferences-me"],
      });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
    onSettled: () => setCompanySavingKey(null),
  });
  const personalMutation = useMutation({
    mutationFn: api.updateMyNotificationPreference,
    onSuccess: (data) =>
      queryClient.setQueryData(["notification-preferences-me"], data),
    onError: (mutationError) => setError(errorMessage(mutationError)),
    onSettled: () => setPersonalSavingKey(null),
  });

  const catalog =
    companyMatrixQ.data?.catalog ?? personalQ.data?.catalog ?? catalogQ.data;
  const companyContour =
    companyMatrixQ.data?.contours.find(
      (contour) => contour.key === companyContourKey,
    ) ?? companyMatrixQ.data?.contours[0];
  const companyRole =
    companyContour?.roles.find((role) => role.key === companyRoleKey) ??
    companyContour?.roles[0];
  const personalContour =
    personalQ.data?.contours.find(
      (contour) => contour.key === personalContourKey,
    ) ?? personalQ.data?.contours[0];
  const sectionClass = compact
    ? "mobileCard notifSettingsSection"
    : "panel notifSettingsSection";

  function changeCompanyCell(cell: EditableCell, enabled: boolean | null) {
    if (!cell.role) return;
    setError(null);
    setCompanySavingKey(cellKey(cell));
    companyMutation.mutate({
      contour: cell.contour,
      role: cell.role,
      eventType: cell.eventType,
      channel: cell.channel,
      enabled,
    });
  }

  function changePersonalCell(cell: EditableCell, enabled: boolean | null) {
    setError(null);
    setPersonalSavingKey(cellKey(cell));
    personalMutation.mutate({
      contour: cell.contour,
      eventType: cell.eventType,
      channel: cell.channel,
      enabled,
    });
  }

  if (catalogQ.isLoading || personalQ.isLoading) {
    return (
      <div
        className={
          compact
            ? "notificationPreferences notificationPreferencesCompact"
            : "notificationPreferences"
        }
      >
        <div className={sectionClass}>
          <h3>Уведомления</h3>
          <div className="muted small">Загрузка…</div>
        </div>
      </div>
    );
  }

  if (catalogQ.isError || personalQ.isError) {
    return (
      <div
        className={
          compact
            ? "notificationPreferences notificationPreferencesCompact"
            : "notificationPreferences"
        }
      >
        <div className={sectionClass}>
          <h3>Уведомления</h3>
          <div className="alert">
            {errorMessage(catalogQ.error ?? personalQ.error)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "notificationPreferences notificationPreferencesCompact"
          : "notificationPreferences"
      }
    >
      {error ? <div className="alert">{error}</div> : null}

      {showCompanyMatrix && catalog?.canManageCompanyRoleMatrix ? (
        <section className={sectionClass}>
          <div className="notifSectionHeader">
            <div>
              <h3>Уведомления</h3>
              <div className="muted small">Настройки ролей компании</div>
            </div>
            {companyMatrixQ.isFetching ? (
              <span className="notifStatusBadge">Обновление</span>
            ) : null}
          </div>

          {companyMatrixQ.isError ? (
            <div className="alert">{errorMessage(companyMatrixQ.error)}</div>
          ) : null}
          <MaxNotice catalog={catalog} />

          {companyMatrixQ.data && companyContour && companyRole && catalog ? (
            <>
              <div
                className="notifSegmentRow"
                role="tablist"
                aria-label="Контур уведомлений компании"
              >
                {companyMatrixQ.data.contours.map((contour) => (
                  <button
                    key={contour.key}
                    type="button"
                    className={
                      contour.key === companyContour.key
                        ? "notifSegmentActive"
                        : "notifSegment"
                    }
                    onClick={() => {
                      setCompanyContourKey(contour.key);
                      setCompanyRoleKey("");
                    }}
                  >
                    {contour.labelRu}
                  </button>
                ))}
              </div>
              <div
                className="notifSegmentRow notifRoleSegments"
                role="tablist"
                aria-label="Роль"
              >
                {companyContour.roles.map((role) => (
                  <button
                    key={role.key}
                    type="button"
                    className={
                      role.key === companyRole.key
                        ? "notifSegmentActive"
                        : "notifSegment"
                    }
                    onClick={() => setCompanyRoleKey(role.key)}
                  >
                    {role.labelRu}
                  </button>
                ))}
              </div>
              <PreferenceRows
                catalog={catalog}
                preferences={companyRole.preferences}
                savingKey={companySavingKey}
                disabled={companyMutation.isPending}
                onChange={changeCompanyCell}
              />
            </>
          ) : null}
        </section>
      ) : null}

      <section className={sectionClass}>
        <div className="notifSectionHeader">
          <div>
            <h3>Личные уведомления</h3>
            <div className="muted small">
              Переопределения текущего пользователя
            </div>
          </div>
          {personalQ.isFetching ? (
            <span className="notifStatusBadge">Обновление</span>
          ) : null}
        </div>
        <MaxNotice catalog={catalog} />

        {personalQ.data && personalQ.data.contours.length === 0 ? (
          <div className="notifEmptyState">
            Для этой роли нет настроек уведомлений по компаниям.
          </div>
        ) : null}

        {personalQ.data && personalContour && catalog ? (
          <>
            {personalQ.data.contours.length > 1 ? (
              <div
                className="notifSegmentRow"
                role="tablist"
                aria-label="Контур личных уведомлений"
              >
                {personalQ.data.contours.map((contour) => (
                  <button
                    key={contour.key}
                    type="button"
                    className={
                      contour.key === personalContour.key
                        ? "notifSegmentActive"
                        : "notifSegment"
                    }
                    onClick={() => setPersonalContourKey(contour.key)}
                  >
                    {contour.labelRu}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="notifCurrentRole">
              <span>Роль</span>
              <strong>{personalContour.role.labelRu}</strong>
            </div>
            <PreferenceRows
              catalog={catalog}
              preferences={personalContour.preferences}
              savingKey={personalSavingKey}
              disabled={personalMutation.isPending}
              onChange={changePersonalCell}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
