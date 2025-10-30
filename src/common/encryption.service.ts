import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly tagLength = 16;
  private readonly tagPosition = this.saltLength + this.ivLength;
  private readonly encryptedPosition = this.tagPosition + this.tagLength;

  private getKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 32) {
      this.logger.error('ENCRYPTION_KEY not set or too short! Using fallback (NOT SECURE FOR PRODUCTION)');
      return 'change-this-to-a-secure-32-char-key!!'; // Fallback для разработки
    }
    return key;
  }

  /**
   * Encrypt sensitive data
   * @param text - Plain text to encrypt
   * @returns Encrypted string in format: salt:iv:authTag:encryptedData (hex)
   */
  async encrypt(text: string): Promise<string> {
    try {
      if (!text) return '';

      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(this.ivLength);
      
      const key = (await scryptAsync(this.getKey(), salt, this.keyLength)) as Buffer;
      
      const cipher = createCipheriv(this.algorithm, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final(),
      ]);
      
      const authTag = cipher.getAuthTag();
      
      // Combine: salt + iv + authTag + encrypted
      const combined = Buffer.concat([salt, iv, authTag, encrypted]);
      
      return combined.toString('hex');
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * @param encryptedHex - Encrypted string in hex format
   * @returns Decrypted plain text
   */
  async decrypt(encryptedHex: string): Promise<string> {
    try {
      if (!encryptedHex) return '';

      const data = Buffer.from(encryptedHex, 'hex');
      
      const salt = data.subarray(0, this.saltLength);
      const iv = data.subarray(this.saltLength, this.tagPosition);
      const authTag = data.subarray(this.tagPosition, this.encryptedPosition);
      const encrypted = data.subarray(this.encryptedPosition);
      
      const key = (await scryptAsync(this.getKey(), salt, this.keyLength)) as Buffer;
      
      const decipher = createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Check if string is encrypted (hex format check)
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;
    // Encrypted string should be hex and have minimum length
    const minLength = (this.saltLength + this.ivLength + this.tagLength) * 2;
    return /^[0-9a-f]+$/i.test(value) && value.length >= minLength;
  }

  /**
   * Encrypt field if not already encrypted
   */
  async encryptIfNeeded(value: string | null): Promise<string | null> {
    if (!value) return null;
    if (this.isEncrypted(value)) return value;
    return this.encrypt(value);
  }

  /**
   * Decrypt field if encrypted, otherwise return as is
   */
  async decryptIfNeeded(value: string | null): Promise<string | null> {
    if (!value) return null;
    if (!this.isEncrypted(value)) return value;
    return this.decrypt(value);
  }
}

