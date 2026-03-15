export function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleString();
}

export function validatePasswordStrength(password: string): string | null {
  const trimmed = password.trim();
  if (trimmed.length < 10) {
    return 'Password must be at least 10 characters long';
  }
  if (!/[A-Z]/.test(trimmed)) {
    return 'Password must include at least one uppercase letter';
  }
  if (!/[a-z]/.test(trimmed)) {
    return 'Password must include at least one lowercase letter';
  }
  if (!/\d/.test(trimmed)) {
    return 'Password must include at least one number';
  }
  if (!/[^A-Za-z0-9]/.test(trimmed)) {
    return 'Password must include at least one symbol';
  }
  return null;
}

export function generateStrongPassword(length: number = 14): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{}';
  const all = upper + lower + digits + symbols;

  const pick = (source: string) => source[Math.floor(Math.random() * source.length)] ?? '';

  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const remainingLength = Math.max(length, required.length) - required.length;

  for (let index = 0; index < remainingLength; index += 1) {
    required.push(pick(all));
  }

  for (let index = required.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = required[index];
    required[index] = required[swapIndex];
    required[swapIndex] = temp;
  }

  return required.join('');
}
