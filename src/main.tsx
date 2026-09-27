import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-400-italic.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "@fontsource/roboto/latin-700-italic.css";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-400-italic.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-700-italic.css";
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import App from "./App";
import "./styles/global.css";
import { installRipple } from "./ui/ripple";

installRipple();

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root mancante in index.html.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
