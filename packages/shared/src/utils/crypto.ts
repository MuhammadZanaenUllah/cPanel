import { randomBytes, createHmac, timingSafeEqual } from 'crypto';

export function generatePassword(length = 16): string {
  return randomBytes(length).toString('hex').slice(0, length);
}

export function signCommand(command: string, args: object, timestamp: number, secret: string): string {
  const payload = JSON.stringify({ command, args, timestamp });
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(command: string, args: object, timestamp: number, signature: string, secret: string): boolean {
  try {
    const expected = signCommand(command, args, timestamp, secret);
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (err) {
    return false;
  }
}
