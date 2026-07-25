import { describe, expect, it } from "vitest";
import {
  createEntityId,
  createFileId,
  createProjectId,
  positionDiscriminator,
} from "../../src/identity/entity-id.js";

describe("entity identity", () => {
  it("creates a stable project id from name and version", () => {
    expect(createProjectId("wallet-service", "1.2.3")).toBe("project:wallet-service@1.2.3");
  });

  it("falls back to a name-only project id when version is missing", () => {
    expect(createProjectId("wallet-service", undefined)).toBe("project:wallet-service");
  });

  it("falls back to project:root when no manifest name is available", () => {
    expect(createProjectId(undefined, undefined)).toBe("project:root");
  });

  it("creates a file id prefixed with file:", () => {
    expect(createFileId("src/wallet/wallet.service.ts")).toBe("file:src/wallet/wallet.service.ts");
  });

  it("builds a deterministic entity id from a segment chain", () => {
    const id = createEntityId("src/wallet/wallet.service.ts", [
      { kind: "class", discriminator: "WalletService" },
      { kind: "method", discriminator: "debit(amount:number,walletId:string)" },
    ]);
    expect(id).toBe(
      "src/wallet/wallet.service.ts::class:WalletService::method:debit(amount:number,walletId:string)",
    );
  });

  it("returns just the relative path when there are no segments", () => {
    expect(createEntityId("src/wallet/wallet.service.ts", [])).toBe("src/wallet/wallet.service.ts");
  });

  it("produces identical ids for identical inputs", () => {
    const segments = [{ kind: "functionDeclaration", discriminator: "debit(amount:number)" }];
    const first = createEntityId("src/wallet.ts", segments);
    const second = createEntityId("src/wallet.ts", segments);
    expect(first).toBe(second);
  });

  it("formats a position discriminator using 1-based line and column", () => {
    expect(positionDiscriminator(12, 5)).toBe("@12:5");
  });
});
