import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReviewApp } from "./ReviewApp";
import "../styles.css";
import "../theme.css";
createRoot(document.getElementById("root")!).render(<StrictMode><ReviewApp/></StrictMode>);
