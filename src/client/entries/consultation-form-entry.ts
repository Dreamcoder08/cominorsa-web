// src/client/entries/consultation-form-entry.ts
//
// Bundle entry point for `src/build/js.ts`. Loaded only on the homepage
// (`src/build/routes.ts`) — the only page with a `#consultation-form`.
import { initConsultationForm } from "../dom/consultation-form";

initConsultationForm();
