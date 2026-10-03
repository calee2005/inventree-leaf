export function DetailHeading({ title, detail, aside }: { title: string; detail?: string; aside?: string }) {
  return (
    <div className="detail-heading">
      {aside ? (
        <div className="detail-title-row">
          <strong>{title}</strong>
          <span className="detail-stock">{aside}</span>
        </div>
      ) : (
        <strong>{title}</strong>
      )}
      {detail ? <p className="detail-spec">{detail}</p> : null}
    </div>
  );
}
