import { PartThumb } from "./PartThumb";

type Props = {
  serverId: string;
  thumbnail: string;
  title: string;
  detail?: string;
  trailing?: string;
  value?: string;
  square?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function PartCard({ serverId, thumbnail, title, detail, trailing, value, square, selected, onClick }: Props) {
  const className = [square ? "part-card stock-card" : "part-card", selected ? "is-on" : ""].filter(Boolean).join(" ");
  const body = (
    <>
      <PartThumb serverId={serverId} thumbnail={thumbnail} />
      <div className="part-body">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
        {trailing || value ? (
          <span className="part-meta">
            {trailing ? <span className="part-qty">{trailing}</span> : null}
            {value ? <span className="part-value">{value}</span> : null}
          </span>
        ) : null}
      </div>
    </>
  );
  if (onClick) {
    return (
      <li>
        <button className={className} type="button" onClick={onClick}>
          {body}
        </button>
      </li>
    );
  }
  return <li className={className}>{body}</li>;
}
