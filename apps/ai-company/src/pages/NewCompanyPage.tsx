import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import {
  COMPANY_INDUSTRIES,
  COMPANY_STATUSES,
  DEFAULT_TIMEZONES,
  type CompanyIndustry,
  type CompanyStatus,
} from '../domain/company/company'
import { useCompanies } from '../hooks/useCompanies'
import { setActiveCompanyId } from '../hooks/useActiveCompany'
import { useI18n } from '../i18n'

export function NewCompanyPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { create } = useCompanies()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('Owner')
  const [industry, setIndustry] = useState<CompanyIndustry>('technology')
  const [country, setCountry] = useState('')
  const [timezone, setTimezone] = useState<string>('UTC')
  const [status, setStatus] = useState<CompanyStatus>('active')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError(t.companyEngine.errors.nameRequired)
      return
    }

    const company = create({
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim(),
      owner: owner.trim(),
      industry,
      country: country.trim(),
      timezone,
      status,
    })

    setActiveCompanyId(company.id)
    navigate(`/ops/companies/${company.id}`)
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.companyEngine.newCompany} description={t.companyEngine.newDescription} />
        <Link to="/ops/companies" className="mcBtn mcBtnSecondary">
          {t.employeeBuilder.cancel}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mcStack">
        <Panel title={t.companyEngine.newFormTitle}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.name}</span>
              <input
                className="mcInput"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.companyEngine.namePlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.companyEngine.fields.slug}</span>
              <input
                className="mcInput"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder={t.companyEngine.slugPlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.companyEngine.fields.description}</span>
              <textarea
                className="mcTextarea"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t.companyEngine.descriptionPlaceholder}
              />
            </label>

            <label className="mcField">
              <span className="mcFieldLabel">{t.companyEngine.owner}</span>
              <input
                className="mcInput"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
              />
            </label>

            <div className="mcFormRow">
              <label className="mcField">
                <span className="mcFieldLabel">{t.companyEngine.fields.industry}</span>
                <select
                  className="mcInput"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value as CompanyIndustry)}
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
                  onChange={(event) => setStatus(event.target.value as CompanyStatus)}
                >
                  {COMPANY_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {t.companyEngine.status[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mcFormRow">
              <label className="mcField">
                <span className="mcFieldLabel">{t.companyEngine.fields.country}</span>
                <input
                  className="mcInput"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder={t.companyEngine.countryPlaceholder}
                />
              </label>
              <label className="mcField">
                <span className="mcFieldLabel">{t.companyEngine.fields.timezone}</span>
                <select
                  className="mcInput"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                >
                  {DEFAULT_TIMEZONES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Panel>

        {error ? <div className="mcFormError">{error}</div> : null}

        <div className="mcFormActions">
          <Link to="/ops/companies" className="mcBtn mcBtnSecondary">
            {t.employeeBuilder.cancel}
          </Link>
          <button type="submit" className="mcBtn mcBtnPrimary">
            {t.companyEngine.createCompany}
          </button>
        </div>
      </form>
    </>
  )
}
