import { Module } from '@nestjs/common'

import { DadataGeocoderService } from './dadata-geocoder.service'
import { DadataSuggestService } from './dadata-suggest.service'

@Module({
  providers: [
    { provide: DadataGeocoderService, useFactory: () => new DadataGeocoderService() },
    { provide: DadataSuggestService, useFactory: () => new DadataSuggestService() },
  ],
  exports: [DadataGeocoderService, DadataSuggestService],
})
export class DadataModule {}
