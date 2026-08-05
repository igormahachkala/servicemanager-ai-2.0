import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'

import { WorkforceService } from './workforce.service'

@Injectable()
export class WorkforceAutoCloseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkforceAutoCloseService.name)
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly workforce: WorkforceService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), 60_000)
    this.timer.unref?.()
    setTimeout(() => void this.run(), 10_000).unref?.()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async run() {
    try {
      const closed = await this.workforce.autoCloseDueShifts()
      if (closed > 0) this.logger.log(`Automatically closed ${closed} workforce shift(s)`)
    } catch (error) {
      this.logger.error('Workforce auto-close failed', error instanceof Error ? error.stack : String(error))
    }
  }
}
