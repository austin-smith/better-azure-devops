type TaskDetailSectionLabelProps = {
  count?: number;
  title: string;
};

export function TaskDetailSectionLabel({
  count,
  title,
}: TaskDetailSectionLabelProps) {
  return (
    <div className="flex items-center justify-between pb-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {count !== undefined ? (
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </div>
  );
}
