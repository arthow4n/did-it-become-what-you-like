import { cx } from "../shared.ts";
import { type BannerProps, NoticeAlert } from "./notice-alert.tsx";

export function StatusMessage(
  { children, tone = "info", className }: Omit<BannerProps, "title" | "action">,
) {
  return (
    <NoticeAlert
      className={cx("ds-status-message", className)}
      tone={tone}
      role="status"
      live="polite"
    >
      {children}
    </NoticeAlert>
  );
}
