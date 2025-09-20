# Proposed Example Projects for `examples/`

This document captures potential additions to the `examples/` directory. Each section outlines a concept, target use case, and implementation sketch that leverages `automcp-ts` adapters.

## 1. LangGraph Incident Response Orchestrator

**Goal**: Demonstrate how LangGraph can coordinate a branching incident response workflow with MCP tools for communication and escalation.

**Why it fits**
- Highlights LangGraph's strength in modeling conditional branches and failure recovery paths.
- Showcases how MCP transports (stdio and SSE) can report incident status updates to downstream clients.
- Emphasizes structured input validation for response playbooks.

**Key ingredients**
- LangGraph nodes representing triage, root-cause analysis, mitigation, and post-mortem stages.
- Tool calls that interact with ticketing APIs (mocked or stubbed for the example) via `automcp-ts` tool registration.
- Streaming updates using the Express/SSE transport to illustrate real-time status dashboards.

**Implementation sketch**
1. Define a Zod schema describing the initial incident report (severity, affected systems, logs).
2. Build LangGraph nodes that encapsulate agents (LLM prompts or deterministic functions) for each stage.
3. Register the graph through `createLangGraphAdapter` and expose it as an MCP tool.
4. Provide an Express server example that streams stage transitions to an HTML dashboard via SSE.
5. Include sample transcripts showing automatic escalation vs. human handoff.

## 2. Streaming Analytics Co-Pilot (Express + OpenAI)

**Goal**: Create a live data analysis assistant that consumes a simulated metrics feed, summarizes anomalies, and exposes insights through MCP.

**Why it fits**
- Demonstrates Express transport with streaming responses and web UI embedding.
- Combines OpenAI function calling with MCP tool registration for analytics workflows.
- Provides a practical demonstration for real-time monitoring scenarios.

**Key ingredients**
- Express server that ingests mock telemetry and stores it in memory.
- OpenAI tool functions that query the latest metrics, calculate trends, and craft natural-language summaries.
- MCP client example (CLI or dashboard) consuming SSE updates while requesting detailed reports.

**Implementation sketch**
1. Define telemetry schemas with Zod to ensure clean inputs for analysis.
2. Implement Express routes that update a metrics buffer and trigger MCP notifications.
3. Use `createOpenAIAdapter` to wrap an OpenAI agent capable of analyzing the buffered data.
4. Demonstrate streaming insight delivery through MCP SSE transport.
5. Document sample prompts for anomaly detection, forecasting, and drill-down questions.

## 3. LlamaIndex Knowledge Base Migration Assistant

**Goal**: Showcase how to migrate content between two knowledge stores using LlamaIndex tools orchestrated via MCP.

**Why it fits**
- Highlights LlamaIndex's document loaders, retrievers, and writers inside an MCP workflow.
- Illustrates how `automcp-ts` can expose long-running migration operations with progress updates.
- Provides tangible utility for teams modernizing internal documentation systems.

**Key ingredients**
- Mock source and destination document stores (JSON files or SQLite) managed by LlamaIndex.
- Tools for chunking, embedding, and validating migrated content.
- Progress reporting via MCP notifications and final summary artifact.

**Implementation sketch**
1. Configure LlamaIndex loaders for the source corpus and writers for the target repository.
2. Create an MCP tool that accepts migration parameters (collections, filters, dry-run flag).
3. Stream migration progress through MCP events, including skipped and retried documents.
4. Provide scripts to verify migrated content and showcase conflict resolution prompts.
5. Document best practices for incremental migrations using the example.

## 4. Pydantic Data Compliance Gatekeeper

**Goal**: Build a compliance-focused agent that validates incoming data payloads against evolving policy rules using Pydantic models.

**Why it fits**
- Leverages Pydantic's powerful validation and serialization capabilities.
- Demonstrates dynamic schema updates and versioning in an MCP context.
- Useful for teams needing auditable data pipelines and automated gatekeeping.

**Key ingredients**
- Versioned Pydantic models representing policy requirements (PII rules, retention flags, etc.).
- MCP tool that validates payloads, emits detailed error reports, and suggests remediations via an LLM helper.
- Optional integration with Express endpoints for batch validation.

**Implementation sketch**
1. Define a base set of Pydantic models with metadata describing policy versions.
2. Implement a validation service wrapped with `createPydanticAdapter`.
3. Add helper functions (OpenAI or local LLM) that propose fixes when validation fails.
4. Demonstrate policy upgrades by swapping to new models and rerunning payloads.
5. Include audit logs as MCP artifacts for compliance review.

## 5. CrewAI Market Intelligence Team

**Goal**: Present a multi-agent CrewAI configuration that gathers market intel, synthesizes findings, and routes tasks to specialists via MCP.

**Why it fits**
- Builds on CrewAI's strength in coordinating specialized agents with role-specific prompts.
- Shows how `automcp-ts` enables MCP clients to interact with the crew as a single tool while maintaining internal coordination.
- Provides a narrative example useful for sales, strategy, or investment teams.

**Key ingredients**
- CrewAI agents for news scraping, competitor analysis, financial modeling, and summary drafting.
- Shared context memory implemented via simple vector store or JSON knowledge base.
- MCP tool interface allowing users to request briefings, deep dives, or quick takes.

**Implementation sketch**
1. Configure CrewAI roles with prompts, tools, and memory sharing rules.
2. Wrap the crew using `createCrewAIAdapter`, exposing parameters like industries, time horizons, and urgency.
3. Provide sample sessions showing iterative refinement (follow-up questions, clarifications).
4. Include automation hooks for scheduling recurring briefings and delivering summaries as MCP artifacts.
5. Document how to extend the crew with additional specialists or alternative data feeds.

---

These proposals aim to cover diverse real-world workflows, demonstrate multiple adapters, and highlight advanced MCP transports. Each report can serve as a blueprint for future additions to the `examples/` catalog.
