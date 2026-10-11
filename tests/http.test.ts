import { describe, expect, it } from "vitest";
import { contentDisposition } from "@/lib/http";

describe("contentDisposition", () => {
  const legal = (h: string) => [...h].every((c) => c.charCodeAt(0) <= 255);

  it("keeps an ASCII name as is", () => {
    expect(contentDisposition("inline", "site.jpg")).toBe(`inline; filename="site.jpg"; filename*=UTF-8''site.jpg`);
  });

  it("makes a macOS screenshot name (narrow no-break space) a legal header, real name in filename*", () => {
    const h = contentDisposition("inline", "Screenshot 2026-07-31 at 1.37.18 PM.png");
    expect(legal(h)).toBe(true);
    expect(h).toContain(`filename="Screenshot 2026-07-31 at 1.37.18_PM.png"`);
    expect(h).toContain("filename*=UTF-8''Screenshot%202026-07-31%20at%201.37.18%E2%80%AFPM.png");
    expect(() => new Response("x", { headers: { "Content-Disposition": h } })).not.toThrow();
  });

  it("handles an Arabic name, quotes, backslashes and path segments", () => {
    const ar = contentDisposition("attachment", "صورة الموقع.jpg");
    expect(legal(ar)).toBe(true);
    expect(decodeURIComponent(ar.split("UTF-8''")[1])).toBe("صورة الموقع.jpg");
    expect(contentDisposition("inline", 'a"b.png')).toContain(`filename="a_b.png"`);
    expect(contentDisposition("inline", "C:\\Users\\me\\site.png")).toContain(`filename="site.png"`); // a Windows path
    expect(contentDisposition("inline", "../../etc/passwd")).toContain(`filename="passwd"`);
  });
});
