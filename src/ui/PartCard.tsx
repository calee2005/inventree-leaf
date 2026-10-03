import { PartThumb } from "./PartThumb";

type Props = {
  serverId: string;
  thumbnail: string;
  title: string;
  detail?: string;
  trailing?: string;
  square?: boolean;
  selected?: boolean;
  onClick?: () => void;
};

export function PartCard({ serverId, thumbnail, title, detail, trailing, square, selected, onClick }: Props) {
  const className = [square ? "part-card stock-card" : "part-card", selected ? "is-on" : ""].filter(Boolean).join(" ");
  const body = (
    <>
      <PartThumb serverId={serverId} thumbnail={thumbnail} />
      <div className="part-body">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
        {trailing ? <span className="part-qty">{trailing}</span> : null}
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
