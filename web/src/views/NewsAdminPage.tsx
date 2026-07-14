import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import * as api from '../lib/api'

const NewsFormSchema = z.object({
  title: z.string().trim().min(3, 'Заголовок: минимум 3 символа').max(200, 'Заголовок: максимум 200 символов'),
  body: z.string().trim().min(1, 'Текст новости обязателен'),
  coverImageUrl: z.string().trim().max(2000).optional().or(z.literal('')),
})

type NewsFormValue = {
  title: string
  body: string
  coverImageUrl: string
}

const emptyForm: NewsFormValue = { title: '', body: '', coverImageUrl: '' }

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function authorLabel(item: api.NewsAdminItem) {
  const a = item.author
  if (!a) return '—'
  const full = [a.firstName, a.lastName].filter(Boolean).join(' ').trim()
  return full || a.email
}

export function NewsAdminPage() {
  const qc = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const newsQ = useQuery({
    queryKey: ['news-admin'],
    queryFn: api.newsAdminList,
    enabled: meQ.data?.role === 'PLATFORM_ADMIN',
  })

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<NewsFormValue>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const list = useMemo(() => newsQ.data || [], [newsQ.data])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const saveM = useMutation({
    mutationFn: async () => {
      const parsed = NewsFormSchema.safeParse(form)
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Проверьте поля формы')
      }
      const payload = {
        title: parsed.data.title,
        body: parsed.data.body,
        coverImageUrl: parsed.data.coverImageUrl ? parsed.data.coverImageUrl : undefined,
      }
      return editingId ? api.updateNews(editingId, payload) : api.createNews(payload)
    },
    onSuccess: async (saved) => {
      setErr(null)
      setSuccess(editingId ? `Новость «${saved.title}» обновлена` : `Черновик «${saved.title}» создан`)
      resetForm()
      await qc.invalidateQueries({ queryKey: ['news-admin'] })
    },
    onError: (error: unknown) => {
      setSuccess(null)
      setErr(error instanceof Error ? error.message : String(error))
    },
  })

  const publishM = useMutation({
    mutationFn: async (id: string) => api.publishNews(id),
    onSuccess: async (published) => {
      setErr(null)
      setSuccess(`Новость «${published.title}» опубликована — push разослан подписчикам`)
      await qc.invalidateQueries({ queryKey: ['news-admin'] })
    },
    onError: (error: unknown) => {
      setSuccess(null)
      setErr(error instanceof Error ? error.message : String(error))
    },
  })

  const deleteM = useMutation({
    mutationFn: async (id: string) => api.deleteNews(id),
    onSuccess: async () => {
      setErr(null)
      setSuccess('Черновик удалён')
      if (editingId) resetForm()
      await qc.invalidateQueries({ queryKey: ['news-admin'] })
    },
    onError: (error: unknown) => {
      setSuccess(null)
      setErr(error instanceof Error ? error.message : String(error))
    },
  })

  if (meQ.isLoading) {
    return <div className="panel">Проверяем доступ...</div>
  }

  if (meQ.data?.role !== 'PLATFORM_ADMIN') {
    return <Navigate to={api.getHomeRoute(meQ.data?.role)} replace />
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)
    saveM.mutate()
  }

  function startEdit(item: api.NewsAdminItem) {
    setEditingId(item.id)
    setForm({ title: item.title, body: item.body, coverImageUrl: item.coverImageUrl || '' })
    setErr(null)
    setSuccess(null)
  }

  function confirmPublish(item: api.NewsAdminItem) {
    const ok = window.confirm(
      `Опубликовать «${item.title}»?\n\nЭто НЕОБРАТИМО разошлёт push-уведомление всем пользователям с включёнными новостями. Убедитесь, что текст готов.`,
    )
    if (ok) publishM.mutate(item.id)
  }

  function confirmDelete(item: api.NewsAdminItem) {
    const ok = window.confirm(`Удалить черновик «${item.title}»? Действие необратимо.`)
    if (ok) deleteM.mutate(item.id)
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Новости</h2>
          <div className="muted small">
            Платформенные новости для всех пользователей: лента в приложении + push при публикации.
          </div>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="alert">{success}</div> : null}
      {newsQ.isError ? (
        <div className="alert">{newsQ.error instanceof Error ? newsQ.error.message : String(newsQ.error)}</div>
      ) : null}

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>{editingId ? 'Редактировать новость' : 'Создать новость'}</h3>
          <form className="form" onSubmit={submit}>
            <label>
              Заголовок
              <input
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                placeholder="Заголовок новости"
                maxLength={200}
              />
            </label>

            <label>
              Текст (markdown / обычный)
              <textarea
                value={form.body}
                onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))}
                placeholder="Текст новости"
                rows={10}
              />
            </label>

            <label>
              Обложка — URL (опционально)
              <input
                value={form.coverImageUrl}
                onChange={(e) => setForm((c) => ({ ...c, coverImageUrl: e.target.value }))}
                placeholder="https://…/cover.jpg"
              />
            </label>
            <div className="muted small">
              Загрузка файла обложки появится позже (нужен backend-эндпоинт). Пока — ссылка на изображение.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saveM.isPending}>
                {saveM.isPending ? 'Сохраняем...' : editingId ? 'Сохранить изменения' : 'Создать черновик'}
              </button>
              {editingId ? (
                <button type="button" className="ghost" onClick={resetForm} disabled={saveM.isPending}>
                  Отмена
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Все новости</h3>
            <div className="muted small">Всего: {list.length}</div>
          </div>

          {newsQ.isLoading ? <div className="muted small">Загрузка...</div> : null}
          {!newsQ.isLoading && list.length === 0 ? <div className="muted small">Новостей пока нет</div> : null}

          <div style={{ display: 'grid', gap: 12 }}>
            {list.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700 }}>{item.title}</div>
                  <span className="tag">{item.status === 'PUBLISHED' ? 'Опубликована' : 'Черновик'}</span>
                </div>
                <div className="muted small">Автор: {authorLabel(item)}</div>
                <div className="muted small">Создана: {formatDate(item.createdAt)}</div>
                <div className="muted small">
                  {item.status === 'PUBLISHED' ? `Опубликована: ${formatDate(item.publishedAt)}` : 'Не опубликована'}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button type="button" className="ghost" onClick={() => startEdit(item)}>
                    Редактировать
                  </button>
                  {item.status === 'DRAFT' ? (
                    <button type="button" onClick={() => confirmPublish(item)} disabled={publishM.isPending}>
                      {publishM.isPending ? 'Публикуем...' : 'Опубликовать'}
                    </button>
                  ) : null}
                  {item.status === 'DRAFT' ? (
                    <button type="button" className="ghost" onClick={() => confirmDelete(item)} disabled={deleteM.isPending}>
                      Удалить
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
