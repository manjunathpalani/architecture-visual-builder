# APPLY UPDATE: Web Application

# APPLY CODE CHANGES NOW

You must edit the workspace. Do not stop at a plan or a summary.
This is a **UPDATE** architecture change for **Web Application**.
Update the existing implementation in place.

Use the feature definition below as the source of truth.

{
  "title": "Clarification Required: Web Application Update",
  "goal": "The goal is to update the Web Application component. However, the provided feature definition does not specify any concrete changes to implement within the Web Application itself, requiring further clarification.",
  "scope": "This instruction is strictly scoped to the 'Web Application' component. No other services or components should be modified.",
  "out_of_scope": [
    "Load Balancer",
    "Monitoring & Alerting Platform",
    "API Layer",
    "Database"
  ],
  "context": "The 'Web Application' is a user-facing web application designed for high availability. It communicates outbound with a 'Load Balancer' via REST API calls to access the API layer. It receives inbound metrics and logs from a 'Monitoring & Alerting Platform' via a custom integration. There is no specific repository linked to this component in the current architecture context.",
  "concrete_implementation_steps": [
    "**Clarification Required**: The provided 'Feature definition' states 'Untitled technical change. No new, updated, or retired components are marked on the canvas yet. Set Architecture state on systems and integrations, then sync.' This statement describes a state within an architecture diagramming tool rather than a concrete feature or technical change to be implemented in the 'Web Application' codebase.",
    "Therefore, no specific coding steps can be provided at this time. The agent should request a clear and actionable feature definition that describes what functionality or modification is expected within the 'Web Application' component."
  ],
  "files_or_areas_to_inspect": [
    "Given the component name 'Web Application' and its role as a user-facing application, inspect typical web application project structures. Common areas would include:",
    "  - `src/` or `app/` directories (for application code)",
    "  - `public/` or `static/` (for static assets)",
    "  - `components/` or `views/` (for UI elements)",
    "  - `services/` or `api/` (for API interaction logic)",
    "  - `config/` (for application configuration)",
    "  - `package.json` or equivalent (for dependencies and scripts)",
    "  - `tests/` (for existing test suites)"
  ],
  "acceptance_checks": [
    "**Cannot be defined**: Without a concrete feature definition, no specific acceptance criteria can be inferred or defined. Acceptance checks would typically verify the successful implementation and functionality of the requested change within the Web Application."
  ],
  "constraints": [
    "Stay scoped to the 'Web Application' component and its assumed codebase path.",
    "Match existing code style, testing patterns, and naming conventions.",
    "Do not invent credentials, secrets, or unrelated systems.",
    "If a repository or specific path is identified for the 'Web Application', work exclusively within that context.",
    "Do not implement any changes that belong to other components (e.g., API changes, database schema modifications, monitoring platform configurations)."
  ]
}
