type Props = {
  message: string
}

export function MobileEmployeeExecutionNotice({ message }: Props) {
  return (
    <div className="acMobileEmployeeExecutionNotice" role="status">
      <p>{message}</p>
    </div>
  )
}
