import { useState } from 'react'
import type { Company } from '../../domain/company/company'
import { COMPANY_INDUSTRIES, COMPANY_STATUSES, DEFAULT_TIMEZONES } from '../../domain/company/company'
import { useCompanies } from '../../hooks/useCompanies'
import { useI18n } from '../../i18n'

export function CompanySettings(props: { company: Company }) {
  const { t } = useI18n()
  const { update } = useCompanies()
  const [name, setName] = useState(props.company.name)
  const [description, setDescription] = useState(props.company.description)
  const [owner, setOwner] = useState(props.company.owner)
  const [country, setCountry] = useState(props.company.country)
  const [timezone, setTimezone] = useState(props.company.timezone)
  const [industry, setIndustry] = useState(props.company.industry)
  const [status, setStatus] = useState(props.company.status)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    update(props.company.id, { name, description, owner, country, timezone, industry, status })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form
      className="mcStack"
      onSubmit={(event) => {
        event.preventDefault()
        handleSave()
      }}
    >
      <label className="mcField">
        <span className="mcFieldLabel">{t.labels.name}</span>
        <input className="mcInput" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="mcField">
        <span className="mcFieldLabel">{t.companyEngine.fields.description}</span>
        <textarea
          className="mcTextarea"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="mcField">
        <span className="mcFieldLabel">{t.companyEngine.owner}</span>
        <input className="mcInput" value={owner} onChange={(e) => setOwner(e.target.value)} />
      </label>
      <div className="mcFormRow">
        <label className="mcField">
          <span className="mcFieldLabel">{t.companyEngine.fields.country}</span>
          <input className="mcInput" value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label className="mcField">
          <span className="mcFieldLabel">{t.companyEngine.fields.timezone}</span>
          <select className="mcInput" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {DEFAULT_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mcFormRow">
        <label className="mcField">
          <span className="mcFieldLabel">{t.companyEngine.fields.industry}</span>
          <select
            className="mcInput"
            value={industry}
            onChange={(e) => setIndustry(e.target.value as Company['industry'])}
          >
            {COMPANY_INDUSTRIES.map((item) => (
              <option key={item} value={item}>
                {t.companyEngine.industry[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="mcField">
          <span className="mcFieldLabel">{t.labels.status}</span>
          <select
            className="mcInput"
            value={status}
            onChange={(e) => setStatus(e.target.value as Company['status'])}
          >
            {COMPANY_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t.companyEngine.status[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mcFormActions">
        <button type="submit" className="mcBtn mcBtnPrimary">
          {t.companyEngine.settings.save}
        </button>
        {saved ? <span className="mcMuted">{t.companyEngine.settings.saved}</span> : null}
      </div>
    </form>
  )
}
