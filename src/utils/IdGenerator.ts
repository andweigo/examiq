/**
 * Offline-safe ID generation utility (no network or server sequence required).
 */
export class IdGenerator {
  public static nextUuid(): string {
    const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return template.replace(/[xy]/g, char => {
      const rand = Math.floor(Math.random() * 16);
      const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  public static nextStudentCode(year: number, sequence: number): string {
    return `${year}-${String(sequence).padStart(4, '0')}`;
  }

  public static nextPrefixedId(prefix: string): string {
    const stamp = Date.now().toString(36);
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${stamp}_${suffix}`;
  }
}
