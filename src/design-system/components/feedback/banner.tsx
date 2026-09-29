import { cx } from "../shared.ts";
import { type BannerProps, NoticeAlert } from "./notice-alert.tsx";

export type { BannerProps };

export function Banner(
  { children, tone = "info", title, action, className }: BannerProps,
) {
  return (
    <NoticeAlert
      className={cx("ds-banner", className)}
      tone={tone}
      title={title}
      action={action}
      role="status"
    >
      {children}
    </NoticeAlert>
  );
}
