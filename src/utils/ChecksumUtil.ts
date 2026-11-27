/**
 * Lightweight offline FNV-1a 32-bit checksum helper used to verify
 * printed QR assignment codes against camera misreads or tampering.
 */
export class ChecksumUtil {
  private static readonly FNV_OFFSET = 0x811c9dc5;
  private static readonly FNV_PRIME = 0x01000193;

  public static compute(input: string): string {
    let hash = ChecksumUtil.FNV_OFFSET;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, ChecksumUtil.FNV_PRIME);
    }
    return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }

  public static verify(input: string, expectedChecksum: string): boolean {
    return ChecksumUtil.compute(input) === expectedChecksum.toUpperCase();
  }
}
