import { describe, expect, it } from "vitest";
import { checkOrigin } from "@/server/http";

describe("browser origin validation", () => {
  it("accepts a browser-facing host when Next uses an internal bind address", () => {
    const request = new Request("http://localhost:3000/api/projects", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } });
    expect(() => checkOrigin(request)).not.toThrow();
  });
  it.each(["http://evil.test", "http://127.0.0.1:4000", "https://127.0.0.1:3000", "null", "http://127.0.0.1:3000/path"])("rejects unrelated origin %s", origin => {
    expect(() => checkOrigin(new Request("http://localhost:3000/api/projects", { headers: { host: "127.0.0.1:3000", origin } }))).toThrow("Cross-origin");
  });
  it("does not trust a forwarded host to authorize a cross-origin browser", () => {
    expect(() => checkOrigin(new Request("http://localhost:3000/api/projects", { headers: { host: "127.0.0.1:3000", "x-forwarded-host": "evil.test", origin: "http://evil.test" } }))).toThrow("Cross-origin");
  });
});
