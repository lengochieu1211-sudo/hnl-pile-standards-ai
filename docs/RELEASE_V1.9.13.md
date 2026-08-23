# HNL Pile Standards AI v1.9.13

## Model synchronization
- Text model is one committed state shared by the top AI quickbar and Settings.
- Settings no longer keeps an independent editable text-model draft.
- Both entry points open the same model picker; all changes still require OK.

## Responsive assistant
- Seven assistant tabs use assistant-container queries and remain visible as 4/3/2 columns.
- Settings cannot disappear off a horizontal tab strip.

## Windows Desktop startup
- Window size is bounded to the Windows work area.
- HNL Bridge readiness is verified by service identity, not by any HTTP response on port 8787.
- Ports 8787–8791 are tried when a port is occupied.
- Bridge health uses a short optional Ollama probe; the UI opens before Ollama startup.
