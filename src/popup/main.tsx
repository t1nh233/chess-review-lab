import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "../styles.css";
import "./popup.css";
import "../theme.css";
import { initTheme } from "../theme/themeMode";
initTheme();
createRoot(document.getElementById("root")!).render(<StrictMode><Popup/></StrictMode>);
