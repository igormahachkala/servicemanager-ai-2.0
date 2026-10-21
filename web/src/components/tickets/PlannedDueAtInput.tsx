import { useState } from 'react'
import { plannedDueFieldHasContent } from '../../lib/plannedDueAt'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  clearButtonClassName?: string
}

/**
 * Поле «Срок выполнения» с кнопкой очистки.
 * Кнопка видна и при частично стёртом значении: браузер в этом случае отдаёт '',
 * а остаток даты остаётся на экране. Очистка пересоздаёт input, потому что
 * WebKit не сбрасывает частичный ввод присваиванием value = ''.
 */
export function PlannedDueAtInput({ value, onChange, disabled, clearButtonClassName = 'ghost' }: Props) {
  const [badInput, setBadInput] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  function clear() {
    setBadInput(false)
    setResetKey((key) => key + 1)
    onChange('')
  }

  return (
    <>
      <input
        key={resetKey}
        type="datetime-local"
        value={value}
        onChange={(e) => {
          setBadInput(e.target.validity.badInput)
          onChange(e.target.value)
        }}
        disabled={disabled}
      />
      {plannedDueFieldHasContent(value, badInput) ? (
        <button type="button" className={clearButtonClassName} onClick={clear} disabled={disabled}>
          Очистить срок
        </button>
      ) : null}
    </>
  )
}
