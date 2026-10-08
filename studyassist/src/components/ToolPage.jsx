export default function ToolPage({ title, description, onBack, backLabel = "Home", children }) {
  return (
    <section className="tool-page">
      <button className="back-button" type="button" onClick={onBack}>← {backLabel}</button>
      <header className="tool-page-header">
        <div><h1>{title}</h1><p>{description}</p></div>
      </header>
      <div className="tool-page-content">{children}</div>
    </section>
  );
}
