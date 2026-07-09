/**
 * @module ViewPerformanceAnalyzer
 * @description Static analyzer for Perspective view.json files.
 * Extracts structural complexity metrics, binding counts, transform types,
 * embedded views, and property data sizes. Works offline with no gateway connection.
 */

import type {
    ComponentTypeStats,
    PerformanceWarning,
    ViewAnalysisMetrics,
    ViewAnalysisResult,
    WarningCategory,
    WarningSeverity
} from '@/core/types/profiler';

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ComponentNode {
    type?: string;
    meta?: { name?: string };
    props?: Record<string, unknown>;
    propConfig?: Record<string, PropConfigEntry>;
    children?: ComponentNode[];
    events?: Record<string, EventConfig>;
    custom?: Record<string, unknown>;
    customMethods?: CustomMethod[];
}

interface PropConfigEntry {
    binding?: BindingConfig;
    persistent?: boolean;
    paramDirection?: string;
}

interface BindingConfig {
    type?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
    transforms?: TransformConfig[];
}

interface TransformConfig {
    type?: string;
    code?: string;
    expression?: string;
    scope?: string;
}

interface EventConfig {
    [key: string]: unknown;
}

interface CustomMethod {
    script?: string;
    name?: string;
}

interface AnalysisAccumulator {
    componentCount: number;
    maxDepth: number;
    totalBindings: number;
    bindingsByType: Record<string, number>;
    totalTransforms: number;
    transformsByType: Record<string, number>;
    scriptTransformCount: number;
    embeddedViewCount: number;
    flexRepeaterCount: number;
    scriptEventCount: number;
    gatewayScopedScriptCount: number;
    largestPropSizeBytes: number;
    largestPropComponentPath: string;
    componentTypeCounts: Record<string, number>;
    warnings: PerformanceWarning[];
}

// ============================================================================
// THRESHOLDS
// ============================================================================

interface Threshold {
    medium: number;
    high: number;
}

const THRESHOLDS = {
    componentCount: { medium: 100, high: 250 } as Threshold,
    maxDepth: { medium: 8, high: 12 } as Threshold,
    totalBindings: { medium: 50, high: 150 } as Threshold,
    scriptTransforms: { medium: 10, high: 30 } as Threshold,
    embeddedViews: { medium: 5, high: 15 } as Threshold,
    flexRepeaters: { medium: 2, high: 5 } as Threshold,
    gatewayScopedScripts: { medium: 3, high: 10 } as Threshold,
    singlePropSizeBytes: { medium: 10_240, high: 51_200 } as Threshold,
    totalViewSizeBytes: { medium: 102_400, high: 512_000 } as Threshold
} as const;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyzes a Perspective view.json and produces performance metrics and warnings.
 *
 * @param viewJson The parsed view.json content
 * @param viewPath Human-readable path to the view (for display)
 * @returns Structured analysis result
 */
export function analyzeView(viewJson: Record<string, unknown>, viewPath: string): ViewAnalysisResult {
    const totalViewSizeBytes = Buffer.byteLength(JSON.stringify(viewJson), 'utf8');

    const accumulator: AnalysisAccumulator = {
        componentCount: 0,
        maxDepth: 0,
        totalBindings: 0,
        bindingsByType: {},
        totalTransforms: 0,
        transformsByType: {},
        scriptTransformCount: 0,
        embeddedViewCount: 0,
        flexRepeaterCount: 0,
        scriptEventCount: 0,
        gatewayScopedScriptCount: 0,
        largestPropSizeBytes: 0,
        largestPropComponentPath: '',
        componentTypeCounts: {},
        warnings: []
    };

    // Walk the root component tree
    const root = viewJson.root as ComponentNode | undefined;
    if (root) {
        walkComponent(root, 'root', 0, accumulator);
    }

    // Also check view-level propConfig (bindings on params, custom, etc.)
    const viewPropConfig = viewJson.propConfig as Record<string, PropConfigEntry> | undefined;
    if (viewPropConfig) {
        extractBindings(viewPropConfig, 'view', accumulator);
    }

    // Generate threshold-based warnings
    generateWarnings(accumulator, totalViewSizeBytes);

    const metrics: ViewAnalysisMetrics = {
        componentCount: accumulator.componentCount,
        maxDepth: accumulator.maxDepth,
        totalBindings: accumulator.totalBindings,
        bindingsByType: { ...accumulator.bindingsByType },
        totalTransforms: accumulator.totalTransforms,
        transformsByType: { ...accumulator.transformsByType },
        scriptTransformCount: accumulator.scriptTransformCount,
        embeddedViewCount: accumulator.embeddedViewCount,
        flexRepeaterCount: accumulator.flexRepeaterCount,
        scriptEventCount: accumulator.scriptEventCount,
        gatewayScopedScriptCount: accumulator.gatewayScopedScriptCount,
        largestPropSizeBytes: accumulator.largestPropSizeBytes,
        largestPropComponentPath: accumulator.largestPropComponentPath
    };

    const componentTypes: ComponentTypeStats[] = Object.entries(accumulator.componentTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

    return {
        viewPath,
        metrics,
        warnings: accumulator.warnings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
        componentTypes,
        totalViewSizeBytes,
        analyzedAt: Date.now()
    };
}

// ============================================================================
// TREE WALKING
// ============================================================================

function walkComponent(node: ComponentNode, path: string, depth: number, acc: AnalysisAccumulator): void {
    acc.componentCount++;
    if (depth > acc.maxDepth) {
        acc.maxDepth = depth;
    }

    // Track component type
    const componentType = node.type ?? 'unknown';
    acc.componentTypeCounts[componentType] = (acc.componentTypeCounts[componentType] ?? 0) + 1;

    // Check for embedded views
    if (componentType === 'ia.display.view') {
        acc.embeddedViewCount++;
    } else if (componentType === 'ia.display.flex-repeater') {
        acc.flexRepeaterCount++;
    }

    // Measure props size
    if (node.props) {
        const propSize = Buffer.byteLength(JSON.stringify(node.props), 'utf8');
        if (propSize > acc.largestPropSizeBytes) {
            acc.largestPropSizeBytes = propSize;
            acc.largestPropComponentPath = path;
        }
    }

    // Extract bindings from propConfig
    if (node.propConfig) {
        extractBindings(node.propConfig, path, acc);
    }

    // Count script events
    if (node.events) {
        countScriptEvents(node.events, path, acc);
    }

    // Count custom methods
    if (node.customMethods) {
        for (const method of node.customMethods) {
            if (method.script) {
                acc.scriptEventCount++;
            }
        }
    }

    // Recurse into children
    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            const child = node.children[i];
            const childName = child.meta?.name ?? String(i);
            walkComponent(child, `${path}/${childName}`, depth + 1, acc);
        }
    }
}

// ============================================================================
// BINDING AND TRANSFORM EXTRACTION
// ============================================================================

function extractBindings(
    propConfig: Record<string, PropConfigEntry>,
    componentPath: string,
    acc: AnalysisAccumulator
): void {
    for (const [, config] of Object.entries(propConfig)) {
        if (!config.binding) {
            continue;
        }

        const binding = config.binding;
        const bindingType = binding.type ?? 'unknown';

        acc.totalBindings++;
        acc.bindingsByType[bindingType] = (acc.bindingsByType[bindingType] ?? 0) + 1;

        // Process transforms
        if (binding.transforms) {
            for (const transform of binding.transforms) {
                const transformType = transform.type ?? 'unknown';
                acc.totalTransforms++;
                acc.transformsByType[transformType] = (acc.transformsByType[transformType] ?? 0) + 1;

                if (transformType === 'script') {
                    acc.scriptTransformCount++;

                    // Check for gateway scope
                    if (transform.scope === 'G' || transform.scope === 'gateway') {
                        acc.gatewayScopedScriptCount++;
                    }
                }
            }
        }
    }
}

function countScriptEvents(
    events: Record<string, EventConfig>,
    _componentPath: string,
    acc: AnalysisAccumulator
): void {
    for (const [, eventConfig] of Object.entries(events)) {
        if (typeof eventConfig === 'object' && eventConfig !== null) {
            // Events can have nested script objects
            countScriptsInObject(eventConfig as Record<string, unknown>, acc);
        }
    }
}

function countScriptsInObject(obj: Record<string, unknown>, acc: AnalysisAccumulator): void {
    for (const [key, value] of Object.entries(obj)) {
        if (key === 'script' && typeof value === 'string' && value.trim().length > 0) {
            acc.scriptEventCount++;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            countScriptsInObject(value as Record<string, unknown>, acc);
        } else if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'object' && item !== null) {
                    countScriptsInObject(item as Record<string, unknown>, acc);
                }
            }
        }
    }
}

// ============================================================================
// WARNING GENERATION
// ============================================================================

function generateWarnings(acc: AnalysisAccumulator, totalViewSizeBytes: number): void {
    checkThreshold(acc, {
        value: acc.componentCount,
        threshold: THRESHOLDS.componentCount,
        category: 'structure',
        messageBase: 'High component count',
        recommendation: 'Consider breaking this view into smaller embedded views'
    });

    checkThreshold(acc, {
        value: acc.maxDepth,
        threshold: THRESHOLDS.maxDepth,
        category: 'structure',
        messageBase: 'Deep component nesting',
        recommendation: 'Flatten the component hierarchy or extract nested sections into embedded views'
    });

    checkThreshold(acc, {
        value: acc.totalBindings,
        threshold: THRESHOLDS.totalBindings,
        category: 'binding',
        messageBase: 'High binding count',
        recommendation: 'Reduce bindings by combining expressions or using indirect bindings'
    });

    checkThreshold(acc, {
        value: acc.scriptTransformCount,
        threshold: THRESHOLDS.scriptTransforms,
        category: 'transform',
        messageBase: 'High script transform count',
        recommendation: 'Replace script transforms with expression transforms or map transforms where possible'
    });

    checkThreshold(acc, {
        value: acc.embeddedViewCount,
        threshold: THRESHOLDS.embeddedViews,
        category: 'embedding',
        messageBase: 'Many embedded views',
        recommendation: 'Consider consolidating views or using parameterized views to reduce nesting'
    });

    checkThreshold(acc, {
        value: acc.flexRepeaterCount,
        threshold: THRESHOLDS.flexRepeaters,
        category: 'embedding',
        messageBase: 'Multiple flex repeaters',
        recommendation: 'Flex repeaters multiply component count - consider pagination or virtualization'
    });

    checkThreshold(acc, {
        value: acc.gatewayScopedScriptCount,
        threshold: THRESHOLDS.gatewayScopedScripts,
        category: 'transform',
        messageBase: 'Many gateway-scoped scripts',
        recommendation:
            'Gateway-scoped scripts add network round-trips - move logic to named queries or gateway message handlers'
    });

    checkThreshold(acc, {
        value: acc.largestPropSizeBytes,
        threshold: THRESHOLDS.singlePropSizeBytes,
        category: 'data',
        messageBase: `Large property data on component "${acc.largestPropComponentPath}"`,
        recommendation: 'Move large static data to a named query or session/page custom properties'
    });

    checkThreshold(acc, {
        value: totalViewSizeBytes,
        threshold: THRESHOLDS.totalViewSizeBytes,
        category: 'data',
        messageBase: 'Large total view size',
        recommendation: 'Break view into smaller embedded views to improve initial load time'
    });
}

interface ThresholdCheck {
    readonly value: number;
    readonly threshold: Threshold;
    readonly category: WarningCategory;
    readonly messageBase: string;
    readonly recommendation: string;
}

function checkThreshold(acc: AnalysisAccumulator, check: ThresholdCheck): void {
    const { value, threshold, category, messageBase, recommendation } = check;
    if (value >= threshold.high) {
        acc.warnings.push({
            severity: 'high',
            category,
            message: `${messageBase}: ${formatValue(value, category)}`,
            componentPath: null,
            recommendation
        });
    } else if (value >= threshold.medium) {
        acc.warnings.push({
            severity: 'medium',
            category,
            message: `${messageBase}: ${formatValue(value, category)}`,
            componentPath: null,
            recommendation
        });
    }
}

// ============================================================================
// HELPERS
// ============================================================================

function severityRank(severity: WarningSeverity): number {
    switch (severity) {
        case 'high':
            return 0;
        case 'medium':
            return 1;
        case 'low':
            return 2;
        default:
            return 3;
    }
}

function formatValue(value: number, category: WarningCategory): string {
    if (category === 'data') {
        return formatBytes(value);
    }
    return String(value);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
