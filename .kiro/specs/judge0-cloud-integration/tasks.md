# Implementation Plan

- [x] 1. Set up Judge0 service foundation

  - [x] 1.1 Create Judge0 service file with configuration interface
    - Create `backend/src/execution/judge0.service.ts`
    - Define Judge0Config, Judge0Submission, Judge0Response interfaces
    - Define Judge0Status enum with all status codes
    - Define LANGUAGE_MAP constant for language ID mapping
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ]\* 1.2 Write property test for language mapping
    - **Property 6: Unsupported Language Rejection**
    - **Validates: Requirements 2.4**
  - [x] 1.3 Implement Judge0Service class constructor and configuration
    - Read JUDGE0_API_KEY from environment
    - Set default values for cpuTimeLimit (10s), memoryLimit (128MB), maxPollingTime (30s)
    - Configure API host (judge0-ce.p.rapidapi.com)
    - _Requirements: 5.1, 3.1, 3.2_

- [-] 2. Implement core submission functionality

  - [x] 2.1 Implement submitCode method
    - Create HTTP POST request to Judge0 /submissions endpoint
    - Base64 encode source_code and stdin
    - Include language_id, cpu_time_limit, memory_limit in request body
    - Include X-RapidAPI-Key header
    - Return submission token from response
    - _Requirements: 1.1, 1.2, 5.3_
  - [ ]\* 2.2 Write property test for request formation
    - **Property 1: Request Formation Completeness**
    - **Validates: Requirements 1.1**
  - [ ]\* 2.3 Write property test for token extraction
    - **Property 2: Token Extraction Consistency**
    - **Validates: Requirements 1.2**
  - [ ]\* 2.4 Write property test for API key header
    - **Property 9: API Key Header Inclusion**
    - **Validates: Requirements 5.3**

- [x] 3. Implement polling and result retrieval

  - [x] 3.1 Implement pollResult method
    - Create HTTP GET request to Judge0 /submissions/{token} endpoint
    - Poll at 500ms intervals until status is not InQueue or Processing
    - Implement maxPollingTime timeout (30 seconds)
    - Return full Judge0Response on completion
    - _Requirements: 1.3, 3.5_
  - [ ]\* 3.2 Write property test for polling correctness
    - **Property 3: Polling Request Correctness**
    - **Validates: Requirements 1.3**
  - [x] 3.3 Implement mapResponseToResult method
    - Decode base64 stdout and stderr
    - Parse time field to milliseconds for executionTime
    - Convert memory from KB to bytes for memoryUsage
    - Map status.id to exitCode and timedOut flag
    - Handle compile_output for compilation errors
    - _Requirements: 1.4, 4.1_
  - [ ]\* 3.4 Write property test for response parsing
    - **Property 4: Response Parsing Completeness**
    - **Validates: Requirements 1.4, 4.1**

- [x] 4. Implement status code and error handling

  - [x] 4.1 Implement mapStatusToResult helper
    - Map Judge0Status.Accepted to exitCode 0
    - Map Judge0Status.TimeLimitExceeded to timedOut true, exitCode 124
    - Map compilation and runtime errors to appropriate exitCode and stderr
    - _Requirements: 3.3, 3.4_
  - [ ]\* 4.2 Write property test for status mapping
    - **Property 7: Judge0 Status Mapping**
    - **Validates: Requirements 3.3, 3.4**
  - [x] 4.3 Implement API error handling
    - Handle 401/403 responses with authentication error message
    - Handle 429 responses with exponential backoff retry (1s, 2s, 4s delays)
    - Handle 5xx responses with single retry
    - Return structured ExecutionResult for all error cases
    - _Requirements: 1.5, 5.4, 6.1, 6.2, 6.3_
  - [ ]\* 4.4 Write property test for error response handling
    - **Property 5: Error Response Handling**
    - **Validates: Requirements 1.5**
  - [ ]\* 4.5 Write property test for auth error handling
    - **Property 10: Authentication Error Handling**
    - **Validates: Requirements 5.4**
  - [ ]\* 4.6 Write property test for rate limit retry
    - **Property 11: Rate Limit Retry Behavior**
    - **Validates: Requirements 6.1**

- [x] 5. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement main executeCode method

  - [x] 6.1 Implement executeCode method
    - Validate language is supported, throw error if not
    - Call submitCode to get token
    - Call pollResult to get response
    - Call mapResponseToResult to convert to ExecutionResult
    - Handle all errors and return structured result
    - _Requirements: 4.2_
  - [ ]\* 6.2 Write property test for interface compatibility
    - **Property 8: Interface Compatibility**
    - **Validates: Requirements 4.2**

- [x] 7. Implement batch execution

  - [x] 7.1 Implement executeBatch method
    - Accept array of ExecutionConfig objects
    - Split into chunks of max 20 submissions
    - Submit each chunk to Judge0 batch endpoint
    - Poll for all tokens and aggregate results
    - Handle partial failures without failing entire batch
    - Return results array matching input order
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]\* 7.2 Write property test for batch round-trip
    - **Property 12: Batch Submission Round-Trip**
    - **Validates: Requirements 7.1, 7.3**
  - [ ]\* 7.3 Write property test for batch chunking
    - **Property 13: Batch Chunking**
    - **Validates: Requirements 7.2**
  - [ ]\* 7.4 Write property test for partial batch failure
    - **Property 14: Partial Batch Failure Isolation**
    - **Validates: Requirements 7.4**

- [x] 8. Implement execution service factory

  - [x] 8.1 Create execution service factory
    - Create `backend/src/execution/index.ts` with factory function
    - Read EXECUTION_BACKEND environment variable
    - Return Judge0Service if backend is 'judge0' and API key exists
    - Fall back to DockerExecutionService if API key missing
    - Return DockerExecutionService if backend is 'docker' or unset
    - Export unified executionService instance
    - _Requirements: 4.3, 5.2_
  - [x] 8.2 Implement healthCheck method
    - Make GET request to Judge0 /about endpoint
    - Return true if response is successful
    - Return false and log error on failure
    - _Requirements: 8.4_
  - [ ]\* 8.3 Write unit tests for factory selection logic
    - Test Docker selection when EXECUTION_BACKEND=docker
    - Test Judge0 selection when EXECUTION_BACKEND=judge0 with API key
    - Test fallback to Docker when API key missing
    - _Requirements: 4.3, 5.2_

- [x] 9. Integrate with existing services

  - [x] 9.1 Update judging service to use execution factory
    - Import executionService from execution factory
    - Replace direct dockerService import
    - No changes to judging logic required
    - _Requirements: 4.1, 4.2_
  - [x] 9.2 Update execution queue to use execution factory
    - Import executionService from execution factory
    - Replace direct dockerService import in worker
    - _Requirements: 4.1, 4.2_
  - [x] 9.3 Add environment variables to configuration
    - Add JUDGE0_API_KEY to .env.example
    - Add EXECUTION_BACKEND to .env.example
    - Document configuration options in README or comments
    - _Requirements: 5.1, 4.3_

- [x] 10. Add logging and monitoring

  - [x] 10.1 Add submission logging
    - Log submission ID, language, and timestamp on submit
    - Log execution time, memory usage, and status on completion
    - Log error details including response body on failure
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 11. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
