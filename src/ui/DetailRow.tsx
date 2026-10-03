import type { ReactNode } from "react";

type Props = {
  title: string;
  detail?: string;
  aside?: string;
  icon?: ReactNode;
  danger?: boolean;
  note?: boolean;
  meter?: number;
  onClick?: () => void;
  chevron?: boolean;
};

export function DetailRow({ title, detail, aside, icon, danger, note, meter, onClick, chevron = true }: Props) {
  const className = danger ? "detail-row is-danger" : "detail-row";
  const body = (
    <>
      {icon ? <span className="detail-icon">{icon}</span> : null}
      <span className="detail-copy">
        <strong>{title}</strong>
        {detail ? <small className={note ? "detail-notes" : undefined}>{detail}</small> : null}
        {meter !== undefined ? (
          <span className="meter">
            <span style={{ width: `${Math.round(meter * 100)}%` }} />
          </span>
        ) : null}
      </span>
      {aside ? <span className="detail-aside">{aside}</span> : null}
      {onClick && chevron ? <RowChevron /> : null}
    </>
  );
  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function RowChevron() {
  return (
    <svg className="row-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
