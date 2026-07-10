/**
 * @module lspProxy/gatewayConfig
 * @description Loads the proxy's single gateway connection from `FLINT_GATEWAY_*` environment
 * variables. The extension sets these when spawning the proxy; power users running the external
 * binary set them by hand.
 */
import type { GatewayConfig, GatewayTokenType } from './types';

/**
 * Infers the token header scheme. A `keyId:secret` shaped token is an Ignition 8.3 native API
 * token; anything else is treated as a Flint bearer token.
 */
export function inferTokenType(token: string): GatewayTokenType {
    return /^[^:\s]+:[^:\s]+$/.test(token) ? 'native' : 'bearer';
}

/** Loads a single gateway config from `FLINT_GATEWAY_*` environment variables, or null if unset. */
export function loadGatewayConfigFromEnv(): GatewayConfig | null {
    const baseUrl = process.env.FLINT_GATEWAY_URL;
    const token = process.env.FLINT_GATEWAY_TOKEN;
    if (baseUrl === undefined || baseUrl === '' || token === undefined || token === '') {
        return null;
    }

    const tokenType = (process.env.FLINT_GATEWAY_TOKEN_TYPE as GatewayTokenType | undefined) ?? inferTokenType(token);

    return {
        id: process.env.FLINT_GATEWAY_ID ?? 'default',
        baseUrl,
        token,
        tokenType,
        insecureTLS: /^(1|true|yes)$/i.test(process.env.FLINT_GATEWAY_INSECURE_TLS ?? '')
    };
}
