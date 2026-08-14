import fs from "node:fs";
import path from "node:path";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Plaid primary finance provider contract", () => {
  const accountsScreen = source(
    "src/features/finance/finance-accounts-screen.tsx",
  );

  it("starts new bank and investment links through their matching Plaid products", () => {
    expect(accountsScreen).toContain("startPlaidLink('transactions')");
    expect(accountsScreen).toContain("startPlaidLink('investments')");
    expect(accountsScreen).toContain("Link bank with Plaid");
    expect(accountsScreen).toContain("Link investments with Plaid");
  });

  it("does not direct new bank links or existing Plaid banks to Teller", () => {
    expect(accountsScreen).not.toContain("startTellerBankLink");
    expect(accountsScreen).not.toContain("Link bank with Teller");
    expect(accountsScreen).not.toContain(
      "Plaid is now reserved for investments",
    );
    expect(accountsScreen).not.toContain("Remove Plaid bank links");
  });

  it("retains sync and disconnect support for existing Teller connections", () => {
    expect(accountsScreen).toContain("provider === 'teller'");
    expect(accountsScreen).toContain("syncTellerEnrollment(connectionId)");
    expect(accountsScreen).toContain(
      "disconnectTellerEnrollment(connectionId)",
    );
  });
});
