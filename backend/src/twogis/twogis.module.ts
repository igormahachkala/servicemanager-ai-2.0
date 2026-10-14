import { Module } from '@nestjs/common';

import { TwogisGeocoderService } from './twogis-geocoder.service';
import { TwogisRoutingService } from './twogis-routing.service';
import { TwogisSuggestService } from './twogis-suggest.service';

@Module({
  providers: [
    { provide: TwogisGeocoderService, useFactory: () => new TwogisGeocoderService() },
    { provide: TwogisSuggestService, useFactory: () => new TwogisSuggestService() },
    { provide: TwogisRoutingService, useFactory: () => new TwogisRoutingService() },
  ],
  exports: [TwogisGeocoderService, TwogisSuggestService, TwogisRoutingService],
})
export class TwogisModule {}
