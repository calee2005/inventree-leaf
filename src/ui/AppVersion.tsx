import pkg from "../../package.json";

export function AppVersion() {
  return <p className="app-version">v{pkg.version}</p>;
}
