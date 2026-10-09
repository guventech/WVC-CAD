import type { ReactNode } from "react";

export type ToolIconButtonProps = {
  readonly label: string;
  readonly title: string;
  readonly icon: ReactNode;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly testId?: string;
  readonly className?: string;
};

/** Compact icon control: visible glyph, name + guidance in hover/aria. */
export function ToolIconButton({
  label,
  title,
  icon,
  pressed = false,
  disabled = false,
  onClick,
  testId,
  className,
}: ToolIconButtonProps) {
  const classes = ["tool-icon-btn"];
  if (pressed) {
    classes.push("is-active");
  }
  if (className !== undefined && className.length > 0) {
    classes.push(className);
  }
  return (
    <button
      type="button"
      className={classes.join(" ")}
      aria-label={label}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={title}
      onClick={onClick}
      data-testid={testId}
    >
      <span className="tool-icon-glyph" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
