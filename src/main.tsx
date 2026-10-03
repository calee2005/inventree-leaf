import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { watchRelease } from "./browser/release";
import "./styles.css";

watchRelease();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
