import { cx } from "../shared.ts";
import { type BannerProps, NoticeAlert } from "./notice-alert.tsx";

export function InlineNotice(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <NoticeAlert
      className={cx("ds-inline-notice", className)}
      role={tone === "danger" ? "alert" : "status"}
      tone={tone}
      title={title}
      action={action}
    >
      {children}
    </NoticeAlert>
  );
}
