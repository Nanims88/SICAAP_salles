export function ErrorBanner({ error }: { error?: string }) {
  return error ? <div className="alert error">{error}</div> : null;
}
