/**
 * @module ProfilerTypes
 * @description TypeScript interfaces for Perspective view performance profiling
 */

// ============================================================================
// SEVERITY AND CATEGORY ENUMS
// ============================================================================

/**
 * Warning severity levels
 */
export type WarningSeverity = 'high' | 'medium' | 'low';

/**
 * Warning categories
 */
export type WarningCategory = 'structure' | 'binding' | 'transform' | 'data' | 'embedding';

// ============================================================================
// STATIC ANALYSIS TYPES
// ============================================================================

/**
 * Result of static analysis on a view.json file
 */
export interface ViewAnalysisResult {
    /** Path to the analyzed view */
    readonly viewPath: string;
    /** Analysis metrics */
    readonly metrics: ViewAnalysisMetrics;
    /** Performance warnings */
    readonly warnings: readonly PerformanceWarning[];
    /** Per-component-type statistics */
    readonly componentTypes: readonly ComponentTypeStats[];
    /** Total JSON byte size of the view */
    readonly totalViewSizeBytes: number;
    /** Analysis timestamp */
    readonly analyzedAt: number;
}

/**
 * Numeric metrics extracted from a view.json
 */
export interface ViewAnalysisMetrics {
    /** Total number of components in the tree */
    readonly componentCount: number;
    /** Maximum nesting depth of the component tree */
    readonly maxDepth: number;
    /** Total number of bindings */
    readonly totalBindings: number;
    /** Bindings broken down by type */
    readonly bindingsByType: Readonly<Record<string, number>>;
    /** Total number of transforms */
    readonly totalTransforms: number;
    /** Transforms broken down by type */
    readonly transformsByType: Readonly<Record<string, number>>;
    /** Number of script transforms specifically */
    readonly scriptTransformCount: number;
    /** Number of embedded views (ia.display.view) */
    readonly embeddedViewCount: number;
    /** Number of flex repeaters (ia.display.flex-repeater) */
    readonly flexRepeaterCount: number;
    /** Number of script event handlers */
    readonly scriptEventCount: number;
    /** Number of gateway-scoped scripts */
    readonly gatewayScopedScriptCount: number;
    /** Largest single property data size in bytes */
    readonly largestPropSizeBytes: number;
    /** Path of component with largest props */
    readonly largestPropComponentPath: string;
}

/**
 * A performance warning with actionable recommendation
 */
export interface PerformanceWarning {
    /** Warning severity */
    readonly severity: WarningSeverity;
    /** Warning category */
    readonly category: WarningCategory;
    /** Human-readable warning message */
    readonly message: string;
    /** Component path this warning relates to (if applicable) */
    readonly componentPath: string | null;
    /** Actionable recommendation */
    readonly recommendation: string;
}

/**
 * Statistics for a specific component type
 */
export interface ComponentTypeStats {
    /** Component type identifier (e.g., "ia.container.flex") */
    readonly type: string;
    /** Number of instances of this type */
    readonly count: number;
}

// ============================================================================
// RUNTIME PROFILING TYPES
// ============================================================================

/**
 * Result of runtime profiling a live Perspective view
 */
export interface ViewProfileResult {
    /** Path to the profiled view */
    readonly viewPath: string;
    /** View instance ID */
    readonly viewInstanceId: string;
    /** Total component count at runtime */
    readonly totalComponentCount: number;
    /** Maximum tree depth at runtime */
    readonly maxTreeDepth: number;
    /** Total binding count */
    readonly totalBindingCount: number;
    /** Bindings broken down by type */
    readonly bindingsByType: Readonly<Record<string, number>>;
    /** Number of bindings still pending */
    readonly pendingBindingCount: number;
    /** Number of resolved bindings */
    readonly resolvedBindingCount: number;
    /** Number of bindings in error state */
    readonly errorBindingCount: number;
    /** Total property tree size in bytes */
    readonly totalPropertySizeBytes: number;
    /** Time taken for profiling in milliseconds */
    readonly profilingDurationMs: number;
    /** Per-component profiles */
    readonly components: readonly ComponentProfile[];
    /** Runtime warnings */
    readonly warnings: readonly PerformanceWarning[];
}

/**
 * Runtime profile data for a single component
 */
export interface ComponentProfile {
    /** Component path in the tree */
    readonly path: string;
    /** Component type */
    readonly type: string;
    /** Component name */
    readonly name: string;
    /** Number of bindings on this component */
    readonly bindingCount: number;
    /** Binding details */
    readonly bindings: readonly BindingProfile[];
    /** Props tree size in bytes */
    readonly propsSizeBytes: number;
    /** Custom properties size in bytes */
    readonly customSizeBytes: number;
    /** Number of child components */
    readonly childCount: number;
}

/**
 * Runtime profile data for a single binding
 */
export interface BindingProfile {
    /** Property path this binding is on (e.g., "props.text") */
    readonly propertyPath: string;
    /** Binding type (tag, property, expression, query) */
    readonly bindingType: string;
    /** Current binding state */
    readonly state: 'pending' | 'good' | 'bad' | 'stale' | 'unknown';
    /** Whether this binding has a script transform */
    readonly hasScriptTransform: boolean;
    /** Number of transforms on this binding */
    readonly transformCount: number;
    /** Last error message if state is 'bad' */
    readonly lastError: string | null;
}

// ============================================================================
// RECORDING PROFILING TYPES
// ============================================================================

/**
 * A single binding state transition event captured during recording
 */
export interface RecordingBindingEvent {
    /** Absolute timestamp in milliseconds */
    readonly timestampMs: number;
    /** Time relative to recording start in milliseconds */
    readonly relativeMs: number;
    /** Component path in the tree */
    readonly componentPath: string;
    /** Component type */
    readonly componentType: string;
    /** Property path this binding is on (e.g., "props.text") */
    readonly propertyPath: string;
    /** Binding type (tag, property, expression, query) */
    readonly bindingType: string;
    /** Previous binding state */
    readonly previousState: string;
    /** New binding state */
    readonly newState: string;
    /** Error message if new state is 'bad' */
    readonly lastError: string | null;
    /** Whether this is a baseline event captured at recording start */
    readonly baseline?: boolean;
}

/**
 * Batch of recording events from a poll cycle
 */
export interface RecordingEventBatch {
    /** Recording session ID */
    readonly recordingId: string;
    /** Events captured in this batch */
    readonly events: readonly RecordingBindingEvent[];
    /** Current count of pending bindings */
    readonly pendingCount: number;
    /** Current count of resolved bindings */
    readonly resolvedCount: number;
    /** Current count of errored bindings */
    readonly errorCount: number;
    /** Current total binding count */
    readonly totalCount: number;
    /** Whether the recording is complete */
    readonly isComplete: boolean;
    /** Reason for completion (if complete) */
    readonly completionReason: string | null;
}

/**
 * Parameters for starting a binding recording session
 */
export interface StartRecordingParams {
    /** Perspective session ID */
    readonly sessionId: string;
    /** Page ID within the session */
    readonly pageId: string;
    /** View instance ID (optional — omit to record all views on the page) */
    readonly viewInstanceId?: string;
    /** Poll interval in milliseconds (default 50) */
    readonly pollIntervalMs?: number;
    /** Maximum recording duration in milliseconds (default 30000) */
    readonly maxDurationMs?: number;
    /** Whether to auto-stop when all bindings resolve (default true) */
    readonly autoStopOnAllResolved?: boolean;
    /** Delay after all bindings resolve before auto-stopping (default 500) */
    readonly autoStopDelayMs?: number;
}

/**
 * Result of starting a recording session
 */
export interface StartRecordingResult {
    /** Whether the recording started successfully */
    readonly success: boolean;
    /** Recording session ID (present on success) */
    readonly recordingId: string | null;
    /** Error message (present on failure) */
    readonly error: string | null;
    /** View path being recorded */
    readonly viewPath: string | null;
    /** Initial pending binding count */
    readonly pendingCount: number;
    /** Initial resolved binding count */
    readonly resolvedCount: number;
    /** Initial errored binding count */
    readonly errorCount: number;
    /** Initial total binding count */
    readonly totalCount: number;
}

/**
 * Result of stopping a recording session
 */
export interface StopRecordingResult {
    /** Whether the recording stopped successfully */
    readonly success: boolean;
    /** Error message (present on failure) */
    readonly error: string | null;
    /** Total recording duration in milliseconds */
    readonly durationMs: number;
    /** Total events recorded */
    readonly totalEventsRecorded: number;
    /** Total poll cycles performed */
    readonly totalPollCount: number;
}

/**
 * Data sent with a recording completion notification
 */
export interface RecordingCompleteData {
    /** Recording session ID */
    readonly recordingId: string;
    /** Reason for completion */
    readonly reason: string;
    /** Final pending binding count */
    readonly pendingCount: number;
    /** Final resolved binding count */
    readonly resolvedCount: number;
    /** Final errored binding count */
    readonly errorCount: number;
    /** Final total binding count */
    readonly totalCount: number;
}

/**
 * Entry for the waterfall timeline display
 */
export interface WaterfallEntry {
    /** Unique key for this binding (componentPath::propertyPath) */
    readonly key: string;
    /** Short display label */
    readonly label: string;
    /** Full component path */
    readonly componentPath: string;
    /** Property path */
    readonly propertyPath: string;
    /** Binding type */
    readonly bindingType: string;
    /** State transition segments for the timeline */
    readonly segments: readonly WaterfallSegment[];
}

/**
 * A time segment in the waterfall timeline
 */
export interface WaterfallSegment {
    /** Start time relative to recording start (ms) */
    readonly startMs: number;
    /** End time relative to recording start (ms), or null if ongoing */
    readonly endMs: number | null;
    /** Binding state during this segment */
    readonly state: string;
    /** Error message if state is 'bad' */
    readonly error: string | null;
}
