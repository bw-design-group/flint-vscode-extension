/**
 * @module ModuleTypes
 * @description Type definitions for Ignition Gateway module configurations
 * Defines module-specific settings at gateway, environment, and resolved levels
 */

/**
 * Project scan endpoint module configuration
 *
 * The same shape is accepted at gateway level and at environment level: gateway-level
 * values act as defaults and environment-level values override them. Every field is
 * optional at both levels so a legacy (environment-less) gateway can declare all of them.
 */
export interface ProjectScanModuleConfig {
    /** Whether the project-scan-endpoint module is installed on this gateway */
    readonly enabled?: boolean;
    /** Path to API token file for 8.3+ Gateway API authentication */
    readonly apiTokenFilePath?: string;
    /** Whether to force update designers when scanning (module endpoint only) */
    readonly forceUpdateDesigner?: boolean;
}

/**
 * Module configurations, valid at both gateway and environment level
 */
export interface GatewayModules {
    /** Project scan endpoint module configuration */
    readonly 'project-scan-endpoint'?: ProjectScanModuleConfig;
}

/**
 * Resolved project scan module configuration
 * Every field comes from the same merge: environment value ?? gateway value ?? default
 */
export interface ResolvedProjectScanModuleConfig {
    /** Whether the module is enabled */
    readonly enabled: boolean;
    /** Path to API token file, if configured at either level */
    readonly apiTokenFilePath?: string;
    /** Whether to force update designers */
    readonly forceUpdateDesigner: boolean;
}

/**
 * Resolved module configurations
 * Merged configuration from gateway and environment levels
 */
export interface ResolvedModules {
    readonly 'project-scan-endpoint': ResolvedProjectScanModuleConfig;
}
