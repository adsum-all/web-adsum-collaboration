# File size exceptions

Files allowed to exceed the 500 line soft limit (absolute max 750), with the
reason. Every entry must stay under 750 lines and carry a justification.

| File | Lines | Reason |
|---|---|---|
| src/components/tableau/TableauPage.tsx | 779 | Rich board page: kanban with drag and drop of cards and columns, inline column editing, WIP limits, filters, list/table view, near-real-time refresh and the embedded card modal. The card tile was extracted to CarteVue.tsx; the column sub-component (ColonneVue) remains inline and is the next scheduled split. |
| src/components/tableau/CarteModalProto.tsx | 536 | Full card detail modal (rich description, checklists with multi-assignee, attachments, comments with edit/delete and reactions, labels, dates, publish-as-activity, live presence). Dense but cohesive single screen; further splits (chat, side panel) tracked for a follow-up. |
| src/components/canal/CanalDetail.tsx | 569 | Instruction-channel detail (notes, workflow steps, moderation, emitters, attachments). Cohesive single screen; next split: extract the workflow timeline and the emitters panel. |
| src/components/canal/CanalPage.tsx | 601 | Instruction-channel page host (space list, channel list, filters, near-real-time refresh, embedded detail). To be split by extracting the channel list and filters. |
| src/api.ts | 586 | HTTP client. Grew to host the Informations module ported verbatim from the back-office (same endpoints, token-based helpers) so the collaboration app offers the same feature. Would be split into src/informations-api.ts if it grows further. |
| src/modeles.css | 621 | Stylesheet for the global board-template library: page tabs, the grouped library (custom vs standard vignettes and tags), the builder (form, columns editor, live preview) and the full-screen preview modal. Cohesive single feature area; a CSS file, not logic. Would be split per sub-area (builder / library / preview) if it grows further. |
