# System Intelligence & Code Workspace Manager

## Project Overview

System Intelligence & Code Workspace Manager is a production-quality Node.js CLI application for collecting host runtime intelligence and managing code files inside a dedicated `workspace/` directory. It gives engineers a structured view of operating system details, selected safe environment variables, system health, memory usage, workspace statistics, file metadata, and operation history.

The project is intentionally dependency-free. It uses modern ES modules, async filesystem APIs, careful input validation, and clear module boundaries so it remains portable, auditable, and easy to extend.

## Features

- System information collection: OS type, OS release, CPU architecture, CPU core count, hostname, Node.js version, platform, home directory, current user, uptime, total memory, and free memory.
- Safe environment variable display: `PATH`, `HOME`, `USER`, `SHELL`, and `TEMP`, with `Not Available` when a variable is missing.
- Console-safe environment formatting: values longer than 80 characters are truncated for readability, while JSON exports retain each complete value.
- Workspace file CRUD: create, read, update, and delete code files inside `workspace/`.
- Update modes: append content or overwrite content.
- File metadata: size, creation timestamp, last modified timestamp, relative path, and absolute path.
- Workspace statistics and insights: file count, total size, largest file, most recently modified file, average file size, total code files, and per-file metadata.
- System health summary: memory usage percentage, memory health label, CPU architecture, and CPU core count.
- System Health Score: weighted 0–100 score based on memory pressure and system uptime, classified as Excellent, Good, Fair, Poor, or Critical.
- Report metadata: unique UUID report ID, ISO generated timestamp, and CLI version read from `package.json`.
- File operation history: JSON-lines history log in `workspace/.operation-history.log`.
- Professional console output: sectioned console tables and human-readable summaries.
- JSON report export: timestamped reports can be exported to any project-local JSON file.
- Robust validation: rejects empty inputs, absolute paths, path traversal, invalid update modes, and unsupported code file extensions.

## Architecture

```text
project/
├── src/
│   ├── collectors/
│   │   └── systemCollector.js
│   ├── fileManager/
│   │   └── fileCrudManager.js
│   ├── utils/
│   │   ├── formatter.js
│   │   ├── logger.js
│   │   └── validator.js
│   └── index.js
├── workspace/
├── README.md
├── package.json
└── sample-output.json
```

- `src/index.js`: CLI boundary. Parses commands, coordinates modules, handles top-level errors, and exports reports.
- `src/collectors/systemCollector.js`: Collects operating system, runtime, environment, and health data.
- `src/fileManager/fileCrudManager.js`: Owns all workspace file operations, metadata retrieval, statistics, and workspace insight calculations.
- `src/utils/formatter.js`: Formats bytes, durations, timestamps, tables, sections, reports, and summaries.
- `src/utils/logger.js`: Provides meaningful runtime logging and persistent operation history.
- `src/utils/validator.js`: Centralizes input validation and path safety rules.

## Code Flow

### Step-by-Step Execution

1. **User executes a CLI command.** The process begins with a command such as `report`, `create`, `read`, `update`, `delete`, `workspace:stats`, or `history`, together with any positional arguments and options.
2. **Arguments are parsed in `src/index.js`.** The CLI entrypoint separates the command name, positional values, and named options such as `--content`, `--mode`, `--json`, and `--limit`.
3. **The command and inputs are validated.** Command routing rejects unknown commands, while `src/utils/validator.js` checks required values, file names, content, write modes, numeric limits, supported extensions, and workspace-relative path safety.
4. **System information is collected when reporting is requested.** `src/collectors/systemCollector.js` gathers operating system, CPU, memory, uptime, runtime, user, and allowlisted environment data, then calculates the System Health Score.
5. **File CRUD requests are routed to the workspace manager.** `src/fileManager/fileCrudManager.js` handles create, read, append or overwrite update, and delete operations while enforcing the `workspace/` boundary and recording operation history.
6. **Workspace analytics are generated.** Report and statistics flows recursively inspect managed files to calculate total size, code-file count, largest file, most recently modified file, and average file size.
7. **Report data is formatted.** `src/utils/formatter.js` converts byte counts, durations, timestamps, health data, metadata, and analytics into structured tables and human-readable summaries. Long environment values are truncated only for console presentation.
8. **JSON is exported when requested.** For commands using `--json`, the complete untruncated report is serialized with report metadata to a validated project-local path.
9. **The error-handling layer protects the complete flow.** Validation and filesystem failures are normalized into actionable errors containing a title, reason, suggestion, and example command. Unexpected errors are caught at the CLI boundary and return a non-zero exit status.
10. **Final output is generated.** Successful operations print professional console sections, metadata, summaries, and success logs; failures print structured guidance to standard error.

### Flow Diagram

```text
User Command
     |
     v
Argument Parsing (src/index.js)
     |
     v
Command and Input Validation
     |
     +--------> File CRUD Routing
     |              |
     |              v
     |         Workspace Boundary Check
     |              |
     |              v
     |         Operation History
     |
     +--------> System Information Collection
     |              |
     |              v
     |         System Health Score
     |
     +--------> Workspace Analytics
     |
     v
Report Formatting and Human-Readable Summary
     |
     +--------> JSON Export (Optional, Full Values)
     |
     v
Final Console Output

Any Stage
     |
     +--------> Error Handling Layer
                     |
                     v
              Actionable Error Output
              and Non-Zero Exit Status
```

## Usage

Install requirements:

```bash
node --version
```

Node.js 18 or newer is required.

Run a report:

```bash
npm start -- report
```

Export a JSON report:

```bash
npm start -- report --json sample-output.json
```

Create a file:

```bash
npm start -- create app.js --content "console.log('hello workspace');"
```

Read a file:

```bash
npm start -- read app.js
```

Append to a file:

```bash
npm start -- update app.js --mode append --content "\nconsole.log(process.version);"
```

Overwrite a file:

```bash
npm start -- update app.js --mode overwrite --content "console.log('rewritten');"
```

Delete a file:

```bash
npm start -- delete app.js
```

Show workspace statistics:

```bash
npm start -- workspace:stats
```

Show operation history:

```bash
npm start -- history --limit 10
```

Run a complete demo and export JSON:

```bash
npm run demo -- --json sample-output.json
```

## Smoke Testing

Run the dependency-free smoke test to verify help, reporting, JSON export, CRUD operations, workspace statistics, operation history, and error handling:

```bash
npm run smoke:test
```

The suite includes positive tests that must exit successfully and negative tests for missing files, missing arguments, path traversal, and unknown commands. Expected failures pass only when the CLI returns a non-zero status and displays an `[ERROR]` message.

Each command is labeled `PASS` or `FAIL`. The runner continues through the full command sequence for useful diagnostics and exits with status code `1` if any check fails. It manages only the dedicated `workspace/smoke-test.js` fixture and writes its report to `outputs/smoke-report.json`.

## Reliability Report

Generate a machine-readable reliability summary from the complete smoke test suite:

```bash
npm run reliability:report
```

The command displays total, passed, and failed test counts with a reliability percentage, then writes `outputs/reliability-report.json`. The report records coverage of help, system reporting, JSON export, CRUD operations, workspace statistics, operation history, error handling, and path safety validation. It exits with status code `1` if the smoke suite fails.

## Strategy

### Architecture Choice

The application follows a clean modular architecture. The CLI layer only orchestrates user intent. Collection logic, file operations, formatting, logging, and validation are placed in separate modules. This separation makes behavior easier to test, reason about, and replace later.

### Error Handling Strategy

Errors are converted into useful user-facing messages at the boundary where they occur. Filesystem errors such as missing files and permission problems are normalized by the file manager. CLI-level errors are caught once in `src/index.js`, logged with timestamps, and produce a non-zero process exit code.

### Security Considerations

All file operations are constrained to `workspace/`. Absolute paths and path traversal attempts are rejected. JSON export and content import paths must remain inside the project directory. Only selected safe environment variables are displayed, avoiding accidental exposure of secrets such as tokens, keys, and credentials.

### Scalability Considerations

The module boundaries allow future additions such as plugin collectors, remote exporters, test suites, structured log sinks, watch mode, compressed workspace snapshots, or policy-based file permissions. Workspace statistics already use recursive traversal, so nested project structures are supported.

## Analytics Model

### System Health Score

The health score is a transparent weighted calculation:

- Memory component: 75% of the final score. Lower memory pressure earns a higher score, with progressively stronger penalties above 75%, 85%, and 95% usage.
- Uptime component: 25% of the final score. Uptime below 7 days scores highest; longer uninterrupted periods gradually reduce the component because they can indicate pending maintenance or restart cycles.
- Unavailable uptime: a neutral score of 70 is used and `uptimeAvailable` is set to `false` in JSON so consumers can distinguish measured and fallback values.

| Final Score | Category |
| --- | --- |
| 90–100 | Excellent |
| 75–89 | Good |
| 60–74 | Fair |
| 40–59 | Poor |
| 0–39 | Critical |

### Workspace Insights

- Most recently modified file: the file with the latest modification timestamp.
- Largest file: the file with the greatest byte size.
- Average file size: total workspace bytes divided by the number of managed files.
- Total code files: files whose extensions match the CLI's supported code-file allowlist.

### Report Metadata

Each generated report contains a UUID `reportId`, an ISO 8601 `generatedTimestamp`, and the current `cliVersion`. Metadata makes exported reports traceable and supports comparison across CLI releases.

## Collected Data Explanation

| Field | Meaning | Why It Is Useful |
| --- | --- | --- |
| OS Type | Operating system family, such as Darwin, Linux, or Windows_NT. | Helps identify host behavior and compatibility constraints. |
| OS Release | Operating system kernel or release version. | Useful for debugging OS-specific runtime issues. |
| CPU Architecture | Processor architecture such as arm64 or x64. | Determines binary compatibility and performance expectations. |
| CPU Core Count | Number of logical CPU cores. | Helps estimate parallel workload capacity. |
| Hostname | Network name of the machine. | Useful for identifying where a report was generated. |
| Node Version | Current Node.js runtime version. | Critical for diagnosing syntax, module, and API compatibility. |
| Platform | Node.js platform identifier. | Useful in scripts that branch by platform. |
| Home Directory | Current user's home path. | Helps understand user-local filesystem context. |
| Current User | Username running the process. | Useful for audit trails and permission diagnosis. |
| System Uptime | Time since the system last started. | Helps identify long-running host state or recent restarts. |
| Total Memory | Total system memory. | Establishes memory capacity. |
| Free Memory | Currently available memory. | Helps evaluate immediate resource pressure. |
| PATH | Executable search path. | Useful for debugging command resolution. |
| HOME | User home directory environment variable. | Commonly used by tooling and scripts. |
| USER | Current user environment variable. | Helpful for shell and CI diagnostics. |
| SHELL | Current shell path. | Useful when reproducing command behavior. |
| TEMP | Temporary directory environment variable. | Useful for diagnosing temporary file behavior. |

## Error Handling Strategy

Every expected CLI failure is presented as an actionable four-part error: a clear title, the reason the operation failed, a recovery suggestion, and an example command. Validation failures exit with status code `1`, making the CLI suitable for shell scripts and CI workflows.

Handled conditions include:

- Missing files during read, update, delete, or metadata lookup.
- Duplicate file creation attempts.
- Permission errors from the filesystem.
- Invalid absolute paths.
- Path traversal attempts using `..`.
- Empty file paths.
- Empty required content.
- Unsupported update modes.
- Unsupported file extensions.
- Missing selected environment variables.
- Invalid JSON export paths.
- Invalid history limits.
- Unexpected runtime errors at the CLI boundary.

### Error Examples

Missing file name:

```text
[ERROR] Missing File Name
Reason: No workspace file name was provided for this operation.
Suggestion: Add a workspace-relative file name after the command.
Example: node src/index.js read app.js
```

Missing or empty content:

```text
[ERROR] Empty Content
Reason: The supplied content contains no usable text.
Suggestion: Provide non-empty source code or text.
Example: node src/index.js update app.js --content "console.log('updated')"
```

Invalid path traversal:

```text
[ERROR] Invalid Workspace Path
Reason: The path "../package.json" would access a location outside the workspace directory.
Suggestion: Use a relative path without leading slashes or parent-directory segments such as "..".
Example: node src/index.js create src/app.js --content "console.log('safe')"
```

Missing file during update:

```text
[ERROR] File Not Found: missing.js
Reason: The file cannot be updated because it does not exist inside the workspace.
Suggestion: Create the file first, then retry the operation.
Example: node src/index.js create missing.js --content "console.log('hello')"
```

Unknown command:

```text
[ERROR] Invalid Command: launch
Reason: "launch" is not a recognized CLI command.
Suggestion: Run the help command to see all supported commands.
Example: node src/index.js help
```

## Sample Output

```text
================================================
   System Information
================================================
┌─────────┬───────────────────┬──────────────────────────────┐
│ (index) │ Field             │ Value                        │
├─────────┼───────────────────┼──────────────────────────────┤
│ 0       │ 'osType'          │ 'Darwin'                     │
│ 1       │ 'osRelease'       │ '25.0.0'                     │
│ 2       │ 'cpuArchitecture' │ 'arm64'                      │
│ 3       │ 'cpuCoreCount'    │ 10                           │
│ 4       │ 'hostname'        │ 'developer-machine.local'    │
│ 5       │ 'nodeVersion'     │ 'v22.16.0'                   │
└─────────┴───────────────────┴──────────────────────────────┘

================================================
   Selected Environment Variables
================================================
PATH   /usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/tooling/bin... [truncated]
HOME   /Users/developer
USER   developer
SHELL  /bin/zsh
TEMP   Not Available
Long values are truncated in console output. JSON export contains full values.

================================================
   Human-Readable Summary
================================================
- Host developer-machine.local is running Darwin 25.0.0 on arm64.
- Memory health is healthy with 63.42% used.
- Workspace contains 1 file(s), using 136 B.
```

## JSON Report Export

Reports include:

- `reportMetadata`
- `generatedAt`
- `systemInfo`
- `environmentVariables`
- `healthSummary`
- `systemHealthScore`
- `workspaceStatistics`
- `workspaceInsights`

The export uses two-space indentation. Each execution receives a unique report ID and timestamp, while analytics remain fully structured for automation or dashboard ingestion.

## Major Implementation Decisions

- No external dependencies: improves portability, auditability, and hackathon reliability.
- ES modules: aligns with modern Node.js development.
- Private class helpers: keeps implementation details inside `FileCrudManager`.
- JSON-lines history log: easy to append, inspect, parse, and stream.
- Explicit safe environment allowlist: avoids leaking sensitive variables.
- Workspace-only file management: reduces accidental destructive behavior.

## Future Improvements

- Add automated tests with Node's built-in test runner.
- Add interactive prompts for users who prefer guided file operations.
- Add file search and syntax-aware metadata.
- Add workspace snapshots and restore points.
- Add configurable allowed file extensions.
- Add HTML report generation.
- Add watch mode for continuous system and workspace monitoring.
- Add CI workflow with linting and smoke tests.
