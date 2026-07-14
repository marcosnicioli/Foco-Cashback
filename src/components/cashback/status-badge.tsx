import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  type LedgerEntryType,
  type WithdrawalStatus,
  situationLabel,
} from "@/modules/cashback/cashback.types";

type Variant = NonNullable<BadgeProps["variant"]>;

function variantFor(entryType: LedgerEntryType, status: WithdrawalStatus | null): Variant {
  if (entryType === "cashback_received") return "success";
  if (entryType === "adjustment_credit") return "success";
  if (entryType === "adjustment_debit") return "destructive";
  // withdrawal
  switch (status) {
    case "requested":
      return "warning";
    case "approved":
      return "info";
    case "paid":
      return "default";
    case "cancelled":
      return "muted";
    default:
      return "muted";
  }
}

export function StatusBadge({
  entryType,
  withdrawalStatus,
}: {
  entryType: LedgerEntryType;
  withdrawalStatus: WithdrawalStatus | null;
}) {
  return (
    <Badge variant={variantFor(entryType, withdrawalStatus)}>
      {situationLabel({ entryType, withdrawalStatus })}
    </Badge>
  );
}
