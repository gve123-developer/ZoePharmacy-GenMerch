  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { installErrorLogger } from "./app/utils/errorLogger";

  // Initialize global error logging
  installErrorLogger();

  createRoot(document.getElementById("root")!).render(<App />);
  