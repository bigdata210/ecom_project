export default function PageTitle({ heading, subtitle, actions }: {
  heading: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-title-row">
      <div>
        <h1>{heading}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      <div className="title-actions">
        <span className="pill demo">예시 데이터</span>
        {actions}
      </div>
    </div>
  );
}
