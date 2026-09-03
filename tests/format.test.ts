import { describe, expect, it } from "vitest";
import { formatFileSize, formatUploadedAt } from "@/lib/format";

describe("formatFileSize", () => {
  it("uses bytes, KB and MB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("2 KB");
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("renders nothing when the size was never recorded", () => {
    // fileSize is nullable, and "null KB" would be worse than a blank.
    expect(formatFileSize(null)).toBe("");
  });
});

describe("formatUploadedAt", () => {
  it("formats unix seconds as an absolute day/month/year date", () => {
    // 2026-09-05T12:00:00Z. Asserted by shape, not exact spelling: the month
    // abbreviation depends on the runtime's ICU data ("Sep" vs "Sept").
    expect(formatUploadedAt(1788609600)).toMatch(/^5 \w+ 2026$/);
  });

  it("does not render an epoch-zero timestamp as a modern date", () => {
    expect(formatUploadedAt(0)).toMatch(/1970$/);
  });
});
