# Requirements Document

## Introduction

This document specifies the requirements for integrating Judge0 Cloud as the code execution backend for the Phantom competitive coding platform. Judge0 is a robust, scalable online code execution system that will replace the current Docker-based execution service, providing better reliability, security, and support for additional programming languages without requiring local Docker infrastructure.

## Glossary

- **Judge0**: An open-source online code execution system that compiles and runs code in a secure, sandboxed environment
- **Judge0 Cloud**: The hosted SaaS version of Judge0 available at judge0.com with API access
- **Submission**: A code execution request sent to Judge0 containing source code, language, and input
- **Token**: A unique identifier returned by Judge0 for tracking submission status
- **Execution Service**: The backend component responsible for running user-submitted code
- **Test Case**: A predefined input/output pair used to validate code correctness
- **Polling**: Repeatedly checking Judge0 API for submission results until completion
- **Callback/Webhook**: A URL that Judge0 calls when execution completes (alternative to polling)

## Requirements

### Requirement 1

**User Story:** As a developer, I want to execute code through Judge0 Cloud API, so that I can run user submissions without managing Docker infrastructure locally.

#### Acceptance Criteria

1. WHEN the system receives a code execution request THEN the Execution Service SHALL send a submission to Judge0 Cloud API with the source code, language ID, and stdin input
2. WHEN Judge0 returns a submission token THEN the Execution Service SHALL store the token for result retrieval
3. WHEN polling for results THEN the Execution Service SHALL retrieve the submission status and output from Judge0 using the token
4. WHEN Judge0 returns a completed submission THEN the Execution Service SHALL parse stdout, stderr, exit code, execution time, and memory usage from the response
5. IF Judge0 API returns an error response THEN the Execution Service SHALL return a structured error result with appropriate error message

### Requirement 2

**User Story:** As a platform operator, I want the system to support multiple programming languages through Judge0, so that users can compete in their preferred language.

#### Acceptance Criteria

1. WHEN a user selects JavaScript THEN the Execution Service SHALL map the request to Judge0 language ID 63 (Node.js)
2. WHEN a user selects Python THEN the Execution Service SHALL map the request to Judge0 language ID 71 (Python 3)
3. WHEN a user selects TypeScript THEN the Execution Service SHALL map the request to Judge0 language ID 74 (TypeScript)
4. WHEN an unsupported language is requested THEN the Execution Service SHALL return an error indicating the language is not supported

### Requirement 3

**User Story:** As a developer, I want the execution service to handle timeouts and resource limits, so that runaway code does not affect system stability.

#### Acceptance Criteria

1. WHEN submitting code to Judge0 THEN the Execution Service SHALL specify a CPU time limit of 10 seconds
2. WHEN submitting code to Judge0 THEN the Execution Service SHALL specify a memory limit of 128 megabytes
3. WHEN Judge0 reports time limit exceeded THEN the Execution Service SHALL return a result with timedOut flag set to true
4. WHEN Judge0 reports memory limit exceeded THEN the Execution Service SHALL return a result indicating memory exceeded error
5. WHEN polling exceeds 30 seconds without completion THEN the Execution Service SHALL timeout and return an error result

### Requirement 4

**User Story:** As a developer, I want the execution service to maintain backward compatibility with the existing interface, so that the judging service continues to work without modification.

#### Acceptance Criteria

1. WHEN the Judge0 service executes code THEN the service SHALL return an ExecutionResult object with stdout, stderr, exitCode, executionTime, memoryUsage, and timedOut fields
2. WHEN the judging service calls executeCode THEN the Judge0 service SHALL accept the same ExecutionConfig interface (language, code, testInput, timeout)
3. WHEN switching between Docker and Judge0 execution THEN the system SHALL use an environment variable to select the execution backend

### Requirement 5

**User Story:** As a platform operator, I want secure API key management for Judge0 Cloud, so that credentials are protected and usage is tracked.

#### Acceptance Criteria

1. WHEN the application starts THEN the Execution Service SHALL read the Judge0 API key from the JUDGE0_API_KEY environment variable
2. WHEN the Judge0 API key is missing THEN the Execution Service SHALL log an error and fall back to Docker execution
3. WHEN making requests to Judge0 THEN the Execution Service SHALL include the API key in the X-RapidAPI-Key header
4. WHEN Judge0 returns a 401 or 403 status THEN the Execution Service SHALL log an authentication error with details

### Requirement 6

**User Story:** As a developer, I want the system to handle Judge0 API rate limits gracefully, so that high traffic does not cause failures.

#### Acceptance Criteria

1. WHEN Judge0 returns a 429 rate limit response THEN the Execution Service SHALL retry the request after a delay using exponential backoff
2. WHEN retrying after rate limit THEN the Execution Service SHALL attempt up to 3 retries with delays of 1, 2, and 4 seconds
3. WHEN all retry attempts fail THEN the Execution Service SHALL return an error result indicating rate limit exceeded

### Requirement 7

**User Story:** As a developer, I want batch submission support for running multiple test cases efficiently, so that judging is faster.

#### Acceptance Criteria

1. WHEN the judging service needs to run multiple test cases THEN the Execution Service SHALL support batch submission to Judge0
2. WHEN submitting a batch THEN the Execution Service SHALL send up to 20 submissions in a single API call
3. WHEN retrieving batch results THEN the Execution Service SHALL poll for all submission tokens and aggregate results
4. WHEN any submission in a batch fails THEN the Execution Service SHALL include the failure in the aggregated results without failing the entire batch

### Requirement 8

**User Story:** As a developer, I want comprehensive logging and monitoring for Judge0 integration, so that issues can be diagnosed quickly.

#### Acceptance Criteria

1. WHEN a submission is sent to Judge0 THEN the Execution Service SHALL log the submission ID, language, and timestamp
2. WHEN a submission completes THEN the Execution Service SHALL log the execution time, memory usage, and status
3. WHEN an error occurs THEN the Execution Service SHALL log the error details including Judge0 response body
4. WHEN the system starts THEN the Execution Service SHALL perform a health check against Judge0 API and log the result
