import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { SafeLogger } from './safe-logger.service';

@Global()
@Module({
  providers: [EncryptionService, SafeLogger],
  exports: [EncryptionService, SafeLogger],
})
export class CommonModule {}

