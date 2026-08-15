import fs from "node:fs";
import path from "node:path";

import {
  buildEzPassFinanceSummary,
  buildEzPassMonthlySeries,
  ezPassImportSaveMode,
  ezPassFriendFilterOptions,
  ezPassFirstName,
  filterEzPassActivitiesByDriver,
  formatEzPassActivityTime,
  groupEzPassActivitiesByDay,
} from "../ezpass-model";
import {
  EZPASS_REPLENISHMENT_CATEGORY,
  financeCategoryById,
} from "../categories";
import type { FinanceTransaction } from "../types";

function transaction(
  id: string,
  amount: number,
  activity: FinanceTransaction["activity"],
  date: string,
  source: FinanceTransaction["source"] = "ezpass",
): FinanceTransaction {
  return {
    id,
    amount,
    currency: "USD",
    date,
    merchant: `Synthetic ${id}`,
    categoryId: "transport",
    entityId: "personal",
    source,
    activity,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  };
}

describe("Finance E-ZPass area", () => {
  it("uses only a trimmed first name on E-ZPass identity labels", () => {
    expect(ezPassFirstName("  Alex Rivera  ")).toBe("Alex");
    expect(ezPassFirstName("Jordan")).toBe("Jordan");
    expect(ezPassFirstName("   ")).toBeUndefined();
  });

  it("offers a file-save action when a re-upload contains only exact duplicates", () => {
    expect(
      ezPassImportSaveMode({
        uniqueCount: 0,
        timeBackfillCount: 0,
        parsedCount: 151,
        exactDuplicateCount: 151,
      }),
    ).toBe("file");
    expect(
      ezPassImportSaveMode({
        uniqueCount: 0,
        timeBackfillCount: 0,
        parsedCount: 0,
        exactDuplicateCount: 0,
      }),
    ).toBeUndefined();
  });

  it("shows every imported activity while excluding funding and adjustments from road spend", () => {
    const summary = buildEzPassFinanceSummary(
      [
        transaction("toll", 8, "expense", "2026-08-14"),
        transaction("refund", -2, "refund", "2026-08-13"),
        transaction("funding", 25, "transfer", "2026-08-12"),
        transaction("adjustment", 4, "adjustment", "2026-07-01"),
        transaction("manual", 99, "expense", "2026-08-14", "manual"),
      ],
      new Date("2026-08-14T16:00:00.000Z"),
    );

    expect(summary.activities.map((row) => row.id)).toEqual([
      "toll",
      "refund",
      "funding",
      "adjustment",
    ]);
    expect(summary.roadActivities.map((row) => row.id)).toEqual([
      "toll",
      "refund",
      "adjustment",
    ]);
    expect(summary.tollActivities.map((row) => row.id)).toEqual([
      "toll",
      "adjustment",
    ]);
    expect(summary.refunds.map((row) => row.id)).toEqual(["refund"]);
    expect(summary.replenishments.map((row) => row.id)).toEqual(["funding"]);
    expect(summary.tollTotal).toBe(8);
    expect(summary.refundTotal).toBe(-2);
    expect(summary.replenishmentTotal).toBe(25);
    expect(summary.spendTotal).toBe(6);
    expect(summary.monthSpend).toBe(6);
    expect(financeCategoryById(EZPASS_REPLENISHMENT_CATEGORY.id).label).toBe(
      "E-ZPass Replenishment",
    );

    const months = buildEzPassMonthlySeries(
      summary.activities,
      2,
      new Date("2026-08-14T16:00:00.000Z"),
    );
    expect(
      months.map(
        ({
          key,
          activityCount,
          tollTotal,
          refundTotal,
          replenishmentTotal,
          netTotal,
        }) => ({
          key,
          activityCount,
          tollTotal,
          refundTotal,
          replenishmentTotal,
          netTotal,
        }),
      ),
    ).toEqual([
      {
        key: "2026-07",
        activityCount: 1,
        tollTotal: 0,
        refundTotal: 0,
        replenishmentTotal: 0,
        netTotal: 0,
      },
      {
        key: "2026-08",
        activityCount: 3,
        tollTotal: 8,
        refundTotal: -2,
        replenishmentTotal: 25,
        netTotal: 6,
      },
    ]);
  });

  it("filters mine and connected-friend activity without changing transaction amounts", () => {
    const mine = transaction("mine", 8, "expense", "2026-08-14");
    const friend = {
      ...transaction("friend", 6, "expense", "2026-08-13"),
      ezPassFriendId: "friend-synthetic",
      ezPassFriendName: "Sample Friend",
    };
    const activities = [mine, friend];
    const ownerAssigned = {
      ...transaction("owner-assigned", 4, "expense", "2026-08-12"),
      ezPassFriendId: "owner-synthetic",
      ezPassFriendName: "Owner Example",
    };

    expect(ezPassFriendFilterOptions(activities)).toEqual([
      { value: "all", label: "All" },
      { value: "mine", label: "Mine" },
      { value: "friend:friend-synthetic", label: "Sample" },
    ]);
    expect(
      ezPassFriendFilterOptions(activities, [
        { userId: "roster-synthetic", displayName: "Alex Rivera" },
      ]),
    ).toContainEqual({
      value: "friend:roster-synthetic",
      label: "Alex",
    });
    expect(
      filterEzPassActivitiesByDriver(activities, "mine").map((row) => row.id),
    ).toEqual(["mine"]);
    expect(
      filterEzPassActivitiesByDriver(
        [...activities, ownerAssigned],
        "mine",
        "owner-synthetic",
      ).map((row) => row.id),
    ).toEqual(["mine", "owner-assigned"]);
    expect(
      ezPassFriendFilterOptions(
        [...activities, ownerAssigned],
        [],
        "owner-synthetic",
      ),
    ).not.toContainEqual({
      value: "friend:owner-synthetic",
      label: "Owner",
    });
    const friendOnly = filterEzPassActivitiesByDriver(
      activities,
      "friend:friend-synthetic",
    );
    expect(friendOnly.map((row) => row.id)).toEqual(["friend"]);
    expect(buildEzPassFinanceSummary(friendOnly).spendTotal).toBe(6);
    expect(buildEzPassFinanceSummary(activities).spendTotal).toBe(14);

    const dayGroups = groupEzPassActivitiesByDay([
      { ...friend, date: "2026-08-14", createdAt: "2026-08-14T13:00:00.000Z" },
      mine,
      transaction("older", 4, "expense", "2026-08-12"),
    ]);
    expect(
      dayGroups.map((group) => ({
        date: group.date,
        ids: group.transactions.map((row) => row.id),
      })),
    ).toEqual([
      { date: "2026-08-14", ids: ["friend", "mine"] },
      { date: "2026-08-12", ids: ["older"] },
    ]);
  });

  it("formats statement times and sorts same-day activity newest first", () => {
    const early = {
      ...transaction("early", 2, "expense", "2026-08-14"),
      activityTime: "07:11:00",
    };
    const late = {
      ...transaction("late", 3, "expense", "2026-08-14"),
      activityTime: "16:25:15",
    };
    expect(formatEzPassActivityTime(early.activityTime)).toBe("7:11:00 AM");
    expect(formatEzPassActivityTime(late.activityTime)).toBe("4:25:15 PM");
    expect(
      groupEzPassActivitiesByDay([early, late])[0]?.transactions.map(
        (row) => row.id,
      ),
    ).toEqual(["late", "early"]);
  });

  it("returns every completed statement import to the dedicated E-ZPass ledger", () => {
    const root = path.resolve(__dirname, "../../../..");
    const importer = fs.readFileSync(
      path.join(root, "src/features/finance/finance-ezpass-import-screen.tsx"),
      "utf8",
    );
    expect(importer).toContain(
      "onPress: () => router.replace('/(tabs)/finance/ezpass')",
    );
    expect(importer).not.toContain(
      "text: 'Done', onPress: () => router.back()",
    );
  });

  it("keeps E-ZPass on the Finance hub without crowding the transactions header", () => {
    const root = path.resolve(__dirname, "../../../..");
    const financeHub = fs.readFileSync(
      path.join(root, "src/features/finance/finance-screen.tsx"),
      "utf8",
    );
    const transactions = fs.readFileSync(
      path.join(root, "src/features/finance/finance-transactions-screen.tsx"),
      "utf8",
    );
    const area = fs.readFileSync(
      path.join(root, "src/features/finance/finance-ezpass-screen.tsx"),
      "utf8",
    );
    const peoplePicker = fs.readFileSync(
      path.join(root, "src/features/social/people-picker.tsx"),
      "utf8",
    );
    const importer = fs.readFileSync(
      path.join(root, "src/features/finance/finance-ezpass-import-screen.tsx"),
      "utf8",
    );
    const importSourceCards = fs.readFileSync(
      path.join(
        root,
        "src/features/finance/finance-ezpass-import-source-cards.tsx",
      ),
      "utf8",
    );
    const monthChart = fs.readFileSync(
      path.join(root, "src/features/finance/finance-ezpass-month-chart.tsx"),
      "utf8",
    );
    const overview = fs.readFileSync(
      path.join(root, "src/features/finance/finance-ezpass-overview-card.tsx"),
      "utf8",
    );
    const friendTag = fs.readFileSync(
      path.join(root, "src/features/finance/finance-ezpass-friend-tag.tsx"),
      "utf8",
    );
    const memberManagement = fs.readFileSync(
      path.join(
        root,
        "src/features/finance/finance-ezpass-member-management.tsx",
      ),
      "utf8",
    );
    const statementFiles = fs.readFileSync(
      path.join(
        root,
        "src/features/finance/finance-ezpass-statement-files.tsx",
      ),
      "utf8",
    );
    const statementStore = fs.readFileSync(
      path.join(root, "src/store/finance-ezpass-statements.ts"),
      "utf8",
    );

    expect(financeHub).toContain("router.push('/(tabs)/finance/ezpass')");
    expect(transactions).not.toContain("router.push('/(tabs)/finance/ezpass')");
    expect(area).toMatch(
      /router\.push\(["']\/\(tabs\)\/finance\/ezpass-import["']\)/,
    );
    expect(area).toContain("AgentUiIds.finance.ezpass.home");
    expect(area).toContain("AgentUiIds.finance.ezpass.share");
    expect(area).toContain("AgentUiIds.finance.ezpass.upload");
    expect(area.indexOf("AgentUiIds.finance.ezpass.share")).toBeLessThan(
      area.indexOf("AgentUiIds.finance.ezpass.upload"),
    );
    expect(area).toContain('icon="share"');
    expect(area).toContain('icon="upload"');
    expect(area).toContain("AgentUiIds.finance.ezpass.emptyUpload");
    expect(area).toContain("AgentUiIds.finance.ezpass.roadActivity");
    expect(area).toContain("AgentUiIds.finance.ezpass.replenishments");
    expect(area).toContain("<FinanceEzPassOverviewCard");
    expect(area).not.toContain("<FinanceEzPassMonthChart");
    expect(overview).toContain("<FinanceEzPassMonthChart");
    expect(overview).toContain("<GlassIconWell");
    expect(overview).toContain('name="route"');
    expect(overview).toContain('title="Driver View"');
    expect(overview).toContain("AgentUiIds.finance.ezpass.summary");
    expect(area).toContain("onSelectMonth={setRequestedMonthKey}");
    expect(area).toMatch(
      /title:\s*["']Tolls & Refunds["'],\s*rows:\s*summary\.roadActivities,\s*total:\s*summary\.spendTotal/,
    );
    expect(area).toMatch(
      /title:\s*["']Replenishments["'],\s*rows:\s*summary\.replenishments,\s*total:\s*summary\.replenishmentTotal/,
    );
    expect(area).toContain("detail={formatMoney(section.total, currency)}");
    expect(monthChart).toContain("accessibilityState={{ selected }}");
    expect(monthChart).toContain("<EzPassTotalMetric");
    expect(monthChart).toContain('label="Tolls"');
    expect(monthChart).toContain('label="Refunds"');
    expect(monthChart).toContain("formatMoney(selected.tollTotal, currency)");
    expect(monthChart).toContain("formatMoney(selected.refundTotal, currency)");
    expect(monthChart).toContain("formatMoney(point.netTotal, currency)");
    expect(monthChart).toContain("style={styles.barValue}");
    expect(monthChart).toContain("styles.totalsRow");
    expect(monthChart).toContain('label="Net"');
    expect(monthChart).toContain('label="Replenished"');
    expect(monthChart).toContain("AgentUiIds.finance.ezpass.month(point.key)");
    expect(area).toContain("<PeoplePicker");
    expect(area).toContain('presentation="searchable-dropdown"');
    expect(peoplePicker).toContain("description: identity.detail");
    expect(peoplePicker).toContain("searchText: identity.searchText");
    expect(peoplePicker).not.toContain("friend.email");
    expect(area).not.toContain("<FinanceEzPassSharingCard");
    expect(area).not.toContain("Shared Drivers");
    expect(area).toContain("addEzPassFriendMembers");
    expect(area).toContain("tagEzPassSharedTransaction");
    expect(area).toContain("activeLedger?.role === 'member'");
    expect(area).toContain("<FinanceEzPassFriendTag");
    expect(overview).toContain("AgentUiIds.finance.ezpass.driverFilter(value)");
    expect(area).toContain("AgentUiIds.finance.ezpass.assignSelf");
    expect(area).toContain("Assign To Me");
    expect(area).toContain("<FinanceEzPassMemberManagement");
    expect(area).toContain("setEzPassMemberRole");
    expect(area).toContain("removeEzPassMember");
    expect(area).toContain("activeLedger.role !== 'member'");
    expect(memberManagement).toContain("Make Co-Host");
    expect(memberManagement).toContain("Make Member");
    expect(memberManagement).toContain("AgentUiIds.finance.ezpass.memberRole(member.userId)");
    expect(memberManagement).toContain("AgentUiIds.finance.ezpass.memberRemove(member.userId)");
    expect(area).toContain("groupEzPassActivitiesByDay(rows)");
    expect(area).toContain("AgentUiIds.finance.ezpass.day(day.date)");
    expect(area).toContain("formatWeekday(day.date)");
    expect(area).toContain(
      "formatEzPassActivityTime(transaction.activityTime)",
    );
    expect(area).not.toContain("ezPassFirstName(transaction.ezPassFriendName)");
    expect(area).not.toContain("transaction.ezPassFriendName,");
    expect(area).toContain(
      "transaction.activity === 'refund' ? 'success' : 'primary'",
    );
    expect(area).not.toContain(
      "transaction.activity === 'transfer' ? 'replenishment'",
    );
    expect(area).toContain(
      "<FinanceEzPassStatementFiles statements={statements} />",
    );
    expect(area.indexOf("<FinanceEzPassStatementFiles")).toBeGreaterThan(
      area.indexOf("<ActivitySections"),
    );
    expect(importer).toContain("activityTime: draft.activityTime");
    expect(importSourceCards).toContain(
      "AgentUiIds.finance.ezpass.officialSite",
    );
    expect(importer).toContain("await openEzPassNyAccount()");
    expect(importer).toContain("await startImport(pickEzPassDocument)");
    expect(importer).toContain(
      "ezPassAssetsFromSharedPayloads(getSharedPayloads())",
    );
    expect(importer).toContain("clearSharedPayloads()");
    expect(importer).toContain("Update times");
    expect(importer).toContain("Save uploaded file");
    expect(importer).toContain("persistEzPassStatementAssets(assets)");
    expect(statementFiles).toContain("openEzPassStatement(statement.uris)");
    expect(statementFiles).toContain("<CollapsibleSection");
    expect(statementFiles).toContain(
      "AgentUiIds.finance.ezpass.statementsToggle",
    );
    expect(statementFiles).not.toContain("defaultExpanded");
    expect(statementFiles).toContain(
      "AgentUiIds.finance.ezpass.statement(statement.id)",
    );
    expect(statementStore).toContain("STORAGE_KEYS.financeEzPassStatements");
    expect(area).toContain("fit titleCase");
    expect(area).toContain("description={fieldTitleCase(");
    expect(area).toContain("displayEzPassMerchantName(transaction.merchant)");
    expect(importer).toContain("displayEzPassMerchantName(draft.merchant)");
    expect(transactions).toContain('generalFinanceTransactions(transactions)');
    expect(transactions).not.toContain("txn.source === 'ezpass'");
    expect(friendTag).toContain("<ProfileAvatar");
    expect(friendTag).toContain("displayName={displayName!}");
    expect(friendTag).toContain("ezPassFirstName(transaction.ezPassFriendName)");
    expect(friendTag).toContain(
      "AgentUiIds.finance.ezpass.friendTag(transaction.id)",
    );
    expect(importer).toContain(
      "draft.activity === 'transfer' ? EZPASS_REPLENISHMENT_CATEGORY.id : categoryId",
    );
    expect(importer.indexOf("AgentUiIds.finance.ezpass.confirm")).toBeLessThan(
      importer.indexOf("deduplicated.unique.map"),
    );
  });
});
